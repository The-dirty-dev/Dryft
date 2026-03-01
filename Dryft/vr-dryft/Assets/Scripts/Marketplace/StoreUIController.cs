using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Drift.API;

namespace Drift.Marketplace
{
    /// <summary>
    /// Controls the VR store interface.
    /// Displays items in a grid, handles category tabs, search, and item details.
    /// </summary>
    public class StoreUIController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform itemGridContainer;
        [SerializeField] private GameObject itemCardPrefab;
        [SerializeField] private Transform categoryTabContainer;
        [SerializeField] private GameObject categoryTabPrefab;
        [SerializeField] private TMP_InputField searchInput;
        [SerializeField] private Button searchButton;

        [Header("Detail Panel")]
        [SerializeField] private GameObject detailPanel;
        [SerializeField] private Image detailThumbnail;
        [SerializeField] private TextMeshProUGUI detailName;
        [SerializeField] private TextMeshProUGUI detailCreator;
        [SerializeField] private TextMeshProUGUI detailDescription;
        [SerializeField] private TextMeshProUGUI detailPrice;
        [SerializeField] private TextMeshProUGUI detailRating;
        [SerializeField] private Button purchaseButton;
        [SerializeField] private TextMeshProUGUI purchaseButtonText;
        [SerializeField] private Button closeDetailButton;

        [Header("Loading/Empty States")]
        [SerializeField] private GameObject loadingIndicator;
        [SerializeField] private GameObject emptyState;
        [SerializeField] private TextMeshProUGUI emptyStateText;

        [Header("Pagination")]
        [SerializeField] private Button prevPageButton;
        [SerializeField] private Button nextPageButton;
        [SerializeField] private TextMeshProUGUI pageIndicator;

        [Header("Settings")]
        [SerializeField] private int itemsPerPage = 12;

        // Events
        public event Action<StoreItem> OnItemPurchased;
        public event Action<StoreItem> OnItemSelected;

        // State
        private List<StoreItem> _currentItems = new List<StoreItem>();
        private List<ItemCategory> _categories = new List<ItemCategory>();
        private StoreItem _selectedItem;
        private string _currentCategory;
        private string _currentSearch;
        private int _currentPage;
        private int _totalItems;
        private bool _isLoading;

        // Services
        private MarketplaceService _service;

        // Pooled item cards
        private List<ItemCard> _itemCards = new List<ItemCard>();

        private void Start()
        {
            _service = MarketplaceService.Instance;

            // Wire up UI events
            if (searchButton != null)
                searchButton.onClick.AddListener(OnSearchClicked);
            if (searchInput != null)
                searchInput.onSubmit.AddListener(OnSearchSubmit);
            if (closeDetailButton != null)
                closeDetailButton.onClick.AddListener(CloseDetailPanel);
            if (purchaseButton != null)
                purchaseButton.onClick.AddListener(OnPurchaseClicked);
            if (prevPageButton != null)
                prevPageButton.onClick.AddListener(OnPrevPage);
            if (nextPageButton != null)
                nextPageButton.onClick.AddListener(OnNextPage);

            // Hide panels initially
            if (detailPanel != null)
                detailPanel.SetActive(false);
            if (loadingIndicator != null)
                loadingIndicator.SetActive(false);
            if (emptyState != null)
                emptyState.SetActive(false);

            // Load initial data
            _ = InitializeAsync();
        }

        private async Task InitializeAsync()
        {
            await LoadCategoriesAsync();
            await LoadItemsAsync();
        }

        /// <summary>
        /// Loads categories and creates tabs.
        /// </summary>
        public async Task LoadCategoriesAsync()
        {
            var response = await _service.GetCategoriesAsync();

            if (response.Success && response.Data?.categories != null)
            {
                _categories.Clear();
                _categories.AddRange(response.Data.categories);

                // Clear existing tabs
                if (categoryTabContainer != null)
                {
                    foreach (Transform child in categoryTabContainer)
                    {
                        Destroy(child.gameObject);
                    }

                    // Add "All" tab
                    CreateCategoryTab("All", null);

                    // Add category tabs
                    foreach (var category in _categories)
                    {
                        CreateCategoryTab(category.name, category.slug);
                    }
                }
            }
        }

        private void CreateCategoryTab(string name, string slug)
        {
            if (categoryTabPrefab == null || categoryTabContainer == null)
                return;

            var tabObj = Instantiate(categoryTabPrefab, categoryTabContainer);
            var button = tabObj.GetComponent<Button>();
            var text = tabObj.GetComponentInChildren<TextMeshProUGUI>();

            if (text != null)
                text.text = name;

            if (button != null)
            {
                button.onClick.AddListener(() => OnCategorySelected(slug));
            }
        }

        /// <summary>
        /// Loads items with current filters.
        /// </summary>
        public async Task LoadItemsAsync()
        {
            if (_isLoading) return;
            _isLoading = true;

            ShowLoading(true);
            ClearItemGrid();

            try
            {
                ApiResponse<StoreItemsResponse> response;

                if (!string.IsNullOrEmpty(_currentSearch))
                {
                    // Search mode
                    var searchResponse = await _service.SearchItemsAsync(
                        _currentSearch,
                        itemsPerPage,
                        _currentPage * itemsPerPage);

                    response = new ApiResponse<StoreItemsResponse>
                    {
                        Success = searchResponse.Success,
                        Error = searchResponse.Error,
                        Data = searchResponse.Success ? new StoreItemsResponse
                        {
                            items = searchResponse.Data.items,
                            total = searchResponse.Data.total,
                            limit = searchResponse.Data.limit,
                            offset = searchResponse.Data.offset
                        } : null
                    };
                }
                else if (!string.IsNullOrEmpty(_currentCategory))
                {
                    // Category mode
                    response = await _service.GetItemsByCategoryAsync(
                        _currentCategory,
                        itemsPerPage,
                        _currentPage * itemsPerPage);
                }
                else
                {
                    // Default mode - all items
                    response = await _service.GetItemsAsync(
                        limit: itemsPerPage,
                        offset: _currentPage * itemsPerPage);
                }

                if (response.Success && response.Data != null)
                {
                    _currentItems.Clear();
                    if (response.Data.items != null)
                    {
                        _currentItems.AddRange(response.Data.items);
                    }
                    _totalItems = response.Data.total;

                    PopulateItemGrid();
                    UpdatePagination();

                    if (_currentItems.Count == 0)
                    {
                        ShowEmptyState("No items found");
                    }
                }
                else
                {
                    ShowEmptyState($"Failed to load: {response.Error}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[StoreUI] Exception: {ex}");
                ShowEmptyState("An error occurred");
            }
            finally
            {
                _isLoading = false;
                ShowLoading(false);
            }
        }

        private void PopulateItemGrid()
        {
            if (itemGridContainer == null || itemCardPrefab == null)
                return;

            foreach (var item in _currentItems)
            {
                var cardObj = Instantiate(itemCardPrefab, itemGridContainer);
                var card = cardObj.GetComponent<ItemCard>();

                if (card != null)
                {
                    card.Setup(item);
                    card.OnClicked += OnItemCardClicked;
                    _itemCards.Add(card);
                }
            }
        }

        private void ClearItemGrid()
        {
            foreach (var card in _itemCards)
            {
                if (card != null)
                {
                    card.OnClicked -= OnItemCardClicked;
                    Destroy(card.gameObject);
                }
            }
            _itemCards.Clear();
        }

        private void OnItemCardClicked(StoreItem item)
        {
            ShowItemDetail(item);
        }

        /// <summary>
        /// Shows the detail panel for an item.
        /// </summary>
        public void ShowItemDetail(StoreItem item)
        {
            _selectedItem = item;
            OnItemSelected?.Invoke(item);

            if (detailPanel == null) return;

            detailPanel.SetActive(true);

            if (detailName != null)
                detailName.text = item.name;
            if (detailCreator != null)
                detailCreator.text = $"by {item.creator_name}";
            if (detailDescription != null)
                detailDescription.text = item.description;
            if (detailPrice != null)
                detailPrice.text = item.FormattedPrice;
            if (detailRating != null)
                detailRating.text = item.rating_count > 0
                    ? $"{item.rating:F1} ({item.rating_count} reviews)"
                    : "No reviews yet";

            // Update purchase button
            UpdatePurchaseButton(item);

            // Load thumbnail
            if (detailThumbnail != null && !string.IsNullOrEmpty(item.thumbnail_url))
            {
                _ = LoadThumbnailAsync(item.thumbnail_url, detailThumbnail);
            }
        }

        private void UpdatePurchaseButton(StoreItem item)
        {
            if (purchaseButton == null || purchaseButtonText == null)
                return;

            if (item.is_owned)
            {
                purchaseButtonText.text = "Owned";
                purchaseButton.interactable = false;
            }
            else if (item.price == 0)
            {
                purchaseButtonText.text = "Get Free";
                purchaseButton.interactable = true;
            }
            else
            {
                purchaseButtonText.text = $"Buy {item.FormattedPrice}";
                purchaseButton.interactable = true;
            }
        }

        public void CloseDetailPanel()
        {
            if (detailPanel != null)
                detailPanel.SetActive(false);
            _selectedItem = null;
        }

        private async void OnPurchaseClicked()
        {
            if (_selectedItem == null) return;

            purchaseButton.interactable = false;
            purchaseButtonText.text = "Processing...";

            try
            {
                var result = await _service.InitiatePurchaseAsync(_selectedItem.id);

                if (result.Success)
                {
                    if (result.Data.IsFree)
                    {
                        // Free item - already acquired
                        Debug.Log($"[StoreUI] Acquired free item: {_selectedItem.name}");
                        _selectedItem.is_owned = true;
                        UpdatePurchaseButton(_selectedItem);

                        // Add to inventory
                        var invItem = new InventoryItem
                        {
                            item_id = _selectedItem.id,
                            item = _selectedItem,
                            is_equipped = false
                        };
                        InventoryManager.Instance?.AddToInventory(invItem);

                        OnItemPurchased?.Invoke(_selectedItem);
                    }
                    else
                    {
                        // Paid item - Stripe payment is handled via mobile companion app.
                        // VR headsets lack browser/keyboard for card entry, so we send
                        // a push notification to the user's linked mobile device with
                        // the payment link / client_secret for checkout.
                        Debug.Log($"[StoreUI] Payment deferred to companion app. Client secret: {result.Data.client_secret}");

                        // Notify mobile companion to open checkout
                        if (Drift.Core.GameManager.Instance != null)
                        {
                            var userId = Drift.Core.GameManager.Instance.UserId;
                            _ = _service.NotifyCompanionForCheckout(result.Data.client_secret, _selectedItem.id);
                        }

                        purchaseButtonText.text = "Complete on phone";
                    }
                }
                else
                {
                    Debug.LogWarning($"[StoreUI] Purchase failed: {result.Error}");
                    purchaseButtonText.text = result.Error;
                    await Task.Delay(2000);
                    UpdatePurchaseButton(_selectedItem);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[StoreUI] Purchase exception: {ex}");
                purchaseButtonText.text = "Error";
                await Task.Delay(2000);
                UpdatePurchaseButton(_selectedItem);
            }
        }

        private void OnCategorySelected(string slug)
        {
            _currentCategory = slug;
            _currentSearch = null;
            _currentPage = 0;

            if (searchInput != null)
                searchInput.text = "";

            _ = LoadItemsAsync();
        }

        private void OnSearchClicked()
        {
            if (searchInput != null)
            {
                PerformSearch(searchInput.text);
            }
        }

        private void OnSearchSubmit(string query)
        {
            PerformSearch(query);
        }

        private void PerformSearch(string query)
        {
            _currentSearch = query?.Trim();
            _currentCategory = null;
            _currentPage = 0;
            _ = LoadItemsAsync();
        }

        private void OnPrevPage()
        {
            if (_currentPage > 0)
            {
                _currentPage--;
                _ = LoadItemsAsync();
            }
        }

        private void OnNextPage()
        {
            int totalPages = Mathf.CeilToInt((float)_totalItems / itemsPerPage);
            if (_currentPage < totalPages - 1)
            {
                _currentPage++;
                _ = LoadItemsAsync();
            }
        }

        private void UpdatePagination()
        {
            int totalPages = Mathf.Max(1, Mathf.CeilToInt((float)_totalItems / itemsPerPage));

            if (pageIndicator != null)
                pageIndicator.text = $"{_currentPage + 1} / {totalPages}";

            if (prevPageButton != null)
                prevPageButton.interactable = _currentPage > 0;

            if (nextPageButton != null)
                nextPageButton.interactable = _currentPage < totalPages - 1;
        }

        private void ShowLoading(bool show)
        {
            if (loadingIndicator != null)
                loadingIndicator.SetActive(show);
            if (emptyState != null && show)
                emptyState.SetActive(false);
        }

        private void ShowEmptyState(string message)
        {
            if (emptyState != null)
            {
                emptyState.SetActive(true);
                if (emptyStateText != null)
                    emptyStateText.text = message;
            }
        }

        private async Task LoadThumbnailAsync(string url, Image target)
        {
            try
            {
                using var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    target.sprite = Sprite.Create(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                        new Vector2(0.5f, 0.5f));
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StoreUI] Failed to load thumbnail: {ex.Message}");
            }
        }

        /// <summary>
        /// Refreshes the store with featured items.
        /// </summary>
        public async Task ShowFeaturedAsync()
        {
            _currentCategory = null;
            _currentSearch = null;
            _currentPage = 0;

            ShowLoading(true);
            ClearItemGrid();

            var response = await _service.GetFeaturedItemsAsync(itemsPerPage);

            if (response.Success && response.Data?.items != null)
            {
                _currentItems.Clear();
                _currentItems.AddRange(response.Data.items);
                _totalItems = response.Data.items.Length;
                PopulateItemGrid();
                UpdatePagination();
            }

            ShowLoading(false);
        }

        /// <summary>
        /// Refreshes the store with popular items.
        /// </summary>
        public async Task ShowPopularAsync()
        {
            _currentCategory = null;
            _currentSearch = null;
            _currentPage = 0;

            ShowLoading(true);
            ClearItemGrid();

            var response = await _service.GetPopularItemsAsync(itemsPerPage);

            if (response.Success && response.Data?.items != null)
            {
                _currentItems.Clear();
                _currentItems.AddRange(response.Data.items);
                _totalItems = response.Data.items.Length;
                PopulateItemGrid();
                UpdatePagination();
            }

            ShowLoading(false);
        }
    }
}
