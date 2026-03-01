using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using Drift.API;

namespace Drift.Marketplace
{
    /// <summary>
    /// Manages the local inventory cache and handles equipping items.
    /// Provides events for UI updates and avatar changes.
    /// </summary>
    public class InventoryManager : MonoBehaviour
    {
        public static InventoryManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private bool loadOnStart = true;
        [SerializeField] private float cacheExpirationMinutes = 5f;

        // Events
        public event Action OnInventoryLoaded;
        public event Action<InventoryItem> OnItemEquipped;
        public event Action<InventoryItem> OnItemUnequipped;
        public event Action<InventoryItem> OnItemAcquired;
        public event Action<string> OnAssetBundleLoaded;

        // Cached data
        private List<InventoryItem> _inventory = new List<InventoryItem>();
        private Dictionary<string, InventoryItem> _itemLookup = new Dictionary<string, InventoryItem>();
        private Dictionary<ItemType, InventoryItem> _equippedByType = new Dictionary<ItemType, InventoryItem>();
        private DateTime _lastFetchTime;

        // Asset bundles
        private Dictionary<string, AssetBundle> _loadedBundles = new Dictionary<string, AssetBundle>();

        // Services
        private MarketplaceService _service;

        public IReadOnlyList<InventoryItem> Items => _inventory;
        public bool IsLoaded => _inventory.Count > 0 || _lastFetchTime != default;
        public bool IsLoading { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            _service = MarketplaceService.Instance;
        }

        private async void Start()
        {
            if (loadOnStart && ApiClient.Instance.IsAuthenticated)
            {
                await RefreshInventoryAsync();
            }
        }

        /// <summary>
        /// Refreshes the inventory from the server.
        /// </summary>
        public async Task RefreshInventoryAsync()
        {
            if (IsLoading) return;

            IsLoading = true;

            try
            {
                // Fetch all inventory
                var response = await _service.GetInventoryAsync(limit: 100);

                if (response.Success && response.Data != null)
                {
                    _inventory.Clear();
                    _itemLookup.Clear();
                    _equippedByType.Clear();

                    if (response.Data.items != null)
                    {
                        foreach (var item in response.Data.items)
                        {
                            _inventory.Add(item);
                            _itemLookup[item.item_id] = item;

                            if (item.is_equipped && item.item != null)
                            {
                                _equippedByType[item.item.ItemType] = item;
                            }
                        }
                    }

                    _lastFetchTime = DateTime.Now;
                    Debug.Log($"[InventoryManager] Loaded {_inventory.Count} items");

                    OnInventoryLoaded?.Invoke();
                }
                else
                {
                    Debug.LogWarning($"[InventoryManager] Failed to load inventory: {response.Error}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[InventoryManager] Exception: {ex}");
            }
            finally
            {
                IsLoading = false;
            }
        }

        /// <summary>
        /// Checks if the inventory cache needs refreshing.
        /// </summary>
        public bool NeedsRefresh()
        {
            if (_lastFetchTime == default) return true;
            return (DateTime.Now - _lastFetchTime).TotalMinutes > cacheExpirationMinutes;
        }

        /// <summary>
        /// Gets items of a specific type from the inventory.
        /// </summary>
        public List<InventoryItem> GetItemsByType(ItemType type)
        {
            var result = new List<InventoryItem>();
            foreach (var item in _inventory)
            {
                if (item.item != null && item.item.ItemType == type)
                {
                    result.Add(item);
                }
            }
            return result;
        }

        /// <summary>
        /// Checks if the user owns an item.
        /// </summary>
        public bool OwnsItem(string itemId)
        {
            return _itemLookup.ContainsKey(itemId);
        }

        /// <summary>
        /// Gets an inventory item by item ID.
        /// </summary>
        public InventoryItem GetItem(string itemId)
        {
            _itemLookup.TryGetValue(itemId, out var item);
            return item;
        }

        /// <summary>
        /// Gets item info from cache or fetches from server.
        /// Used for loading remote player avatars.
        /// </summary>
        public async Task<InventoryItem> GetItemInfoAsync(string itemId)
        {
            // Check local cache first
            if (_itemLookup.TryGetValue(itemId, out var cached))
            {
                return cached;
            }

            // Fetch from server for remote player items
            try
            {
                var response = await _service.GetItemDetailsAsync(itemId);
                if (response.Success && response.Data != null)
                {
                    // Create a temporary inventory item for loading
                    var item = new InventoryItem
                    {
                        item_id = itemId,
                        item = response.Data,
                        is_equipped = false
                    };
                    return item;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[InventoryManager] Failed to get item info: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Gets the currently equipped item of a specific type.
        /// </summary>
        public InventoryItem GetEquippedItem(ItemType type)
        {
            _equippedByType.TryGetValue(type, out var item);
            return item;
        }

        /// <summary>
        /// Gets all currently equipped items.
        /// </summary>
        public List<InventoryItem> GetEquippedItems()
        {
            return new List<InventoryItem>(_equippedByType.Values);
        }

        /// <summary>
        /// Equips an item. Automatically unequips any item of the same type.
        /// </summary>
        public async Task<bool> EquipItemAsync(string itemId)
        {
            if (!_itemLookup.TryGetValue(itemId, out var item))
            {
                Debug.LogWarning($"[InventoryManager] Item not in inventory: {itemId}");
                return false;
            }

            try
            {
                var response = await _service.EquipItemAsync(itemId);

                if (response.Success)
                {
                    // Update local state
                    var itemType = item.item.ItemType;

                    // Unequip previous item of this type locally
                    if (_equippedByType.TryGetValue(itemType, out var previousItem))
                    {
                        previousItem.is_equipped = false;
                        OnItemUnequipped?.Invoke(previousItem);
                    }

                    // Equip new item locally
                    item.is_equipped = true;
                    _equippedByType[itemType] = item;

                    Debug.Log($"[InventoryManager] Equipped: {item.item.name}");
                    OnItemEquipped?.Invoke(item);

                    return true;
                }
                else
                {
                    Debug.LogWarning($"[InventoryManager] Failed to equip: {response.Error}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[InventoryManager] Equip exception: {ex}");
                return false;
            }
        }

        /// <summary>
        /// Unequips an item.
        /// </summary>
        public async Task<bool> UnequipItemAsync(string itemId)
        {
            if (!_itemLookup.TryGetValue(itemId, out var item))
            {
                Debug.LogWarning($"[InventoryManager] Item not in inventory: {itemId}");
                return false;
            }

            try
            {
                var response = await _service.UnequipItemAsync(itemId);

                if (response.Success)
                {
                    // Update local state
                    item.is_equipped = false;

                    var itemType = item.item.ItemType;
                    if (_equippedByType.TryGetValue(itemType, out var equipped) && equipped.item_id == itemId)
                    {
                        _equippedByType.Remove(itemType);
                    }

                    Debug.Log($"[InventoryManager] Unequipped: {item.item.name}");
                    OnItemUnequipped?.Invoke(item);

                    return true;
                }
                else
                {
                    Debug.LogWarning($"[InventoryManager] Failed to unequip: {response.Error}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[InventoryManager] Unequip exception: {ex}");
                return false;
            }
        }

        /// <summary>
        /// Adds an item to the local inventory (after purchase).
        /// </summary>
        public void AddToInventory(InventoryItem item)
        {
            if (!_itemLookup.ContainsKey(item.item_id))
            {
                _inventory.Add(item);
                _itemLookup[item.item_id] = item;
                Debug.Log($"[InventoryManager] Added to inventory: {item.item?.name}");
                OnItemAcquired?.Invoke(item);
            }
        }

        /// <summary>
        /// Loads an asset bundle for an item.
        /// </summary>
        public async Task<AssetBundle> LoadAssetBundleAsync(string itemId)
        {
            // Check cache first
            if (_loadedBundles.TryGetValue(itemId, out var cached))
            {
                return cached;
            }

            try
            {
                // Get bundle URL from server
                var response = await _service.GetAssetBundleAsync(itemId);

                if (!response.Success || string.IsNullOrEmpty(response.Data?.asset_bundle))
                {
                    Debug.LogWarning($"[InventoryManager] Failed to get asset bundle URL: {response.Error}");
                    return null;
                }

                var bundleUrl = response.Data.asset_bundle;
                Debug.Log($"[InventoryManager] Loading asset bundle: {bundleUrl}");

                // Download and load the bundle
                var request = UnityEngine.Networking.UnityWebRequestAssetBundle.GetAssetBundle(bundleUrl);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (request.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"[InventoryManager] Failed to download bundle: {request.error}");
                    return null;
                }

                var bundle = UnityEngine.Networking.DownloadHandlerAssetBundle.GetContent(request);
                _loadedBundles[itemId] = bundle;

                Debug.Log($"[InventoryManager] Asset bundle loaded: {itemId}");
                OnAssetBundleLoaded?.Invoke(itemId);

                return bundle;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[InventoryManager] Exception loading bundle: {ex}");
                return null;
            }
        }

        /// <summary>
        /// Unloads an asset bundle.
        /// </summary>
        public void UnloadAssetBundle(string itemId, bool unloadAllLoadedObjects = true)
        {
            if (_loadedBundles.TryGetValue(itemId, out var bundle))
            {
                bundle.Unload(unloadAllLoadedObjects);
                _loadedBundles.Remove(itemId);
                Debug.Log($"[InventoryManager] Asset bundle unloaded: {itemId}");
            }
        }

        /// <summary>
        /// Unloads all asset bundles.
        /// </summary>
        public void UnloadAllBundles()
        {
            foreach (var bundle in _loadedBundles.Values)
            {
                bundle.Unload(true);
            }
            _loadedBundles.Clear();
        }

        private void OnDestroy()
        {
            UnloadAllBundles();
        }
    }
}
