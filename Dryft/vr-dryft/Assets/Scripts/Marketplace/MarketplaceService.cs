using System;
using System.Threading.Tasks;
using UnityEngine;
using Drift.API;

namespace Drift.Marketplace
{
    /// <summary>
    /// Service for interacting with the marketplace API.
    /// Provides methods for browsing items, making purchases, and managing inventory.
    /// </summary>
    public class MarketplaceService
    {
        private static MarketplaceService _instance;
        public static MarketplaceService Instance => _instance ??= new MarketplaceService();

        private readonly ApiClient _api;

        public MarketplaceService()
        {
            _api = ApiClient.Instance;
        }

        // =====================================================================
        // Store Browsing
        // =====================================================================

        /// <summary>
        /// Gets store items with optional filtering.
        /// </summary>
        public async Task<ApiResponse<StoreItemsResponse>> GetItemsAsync(
            ItemType? type = null,
            string categoryId = null,
            string creatorId = null,
            long? minPrice = null,
            long? maxPrice = null,
            string search = null,
            bool? featured = null,
            string sortBy = null,
            string sortOrder = null,
            int limit = 20,
            int offset = 0)
        {
            var queryParams = new System.Text.StringBuilder();
            queryParams.Append($"?limit={limit}&offset={offset}");

            if (type.HasValue)
                queryParams.Append($"&type={type.Value.ToString().ToLower()}");
            if (!string.IsNullOrEmpty(categoryId))
                queryParams.Append($"&category_id={categoryId}");
            if (!string.IsNullOrEmpty(creatorId))
                queryParams.Append($"&creator_id={creatorId}");
            if (minPrice.HasValue)
                queryParams.Append($"&min_price={minPrice.Value}");
            if (maxPrice.HasValue)
                queryParams.Append($"&max_price={maxPrice.Value}");
            if (!string.IsNullOrEmpty(search))
                queryParams.Append($"&search={Uri.EscapeDataString(search)}");
            if (featured.HasValue && featured.Value)
                queryParams.Append("&featured=true");
            if (!string.IsNullOrEmpty(sortBy))
                queryParams.Append($"&sort_by={sortBy}");
            if (!string.IsNullOrEmpty(sortOrder))
                queryParams.Append($"&sort_order={sortOrder}");

            return await _api.GetAsync<StoreItemsResponse>($"/v1/store/items{queryParams}");
        }

        /// <summary>
        /// Gets a single item by ID.
        /// </summary>
        public async Task<ApiResponse<StoreItem>> GetItemAsync(string itemId)
        {
            return await _api.GetAsync<StoreItem>($"/v1/store/items/{itemId}");
        }

        /// <summary>
        /// Legacy compatibility alias for fetching a single item.
        /// </summary>
        public async Task<ApiResponse<StoreItem>> GetItemDetailsAsync(string itemId)
        {
            return await GetItemAsync(itemId);
        }

        /// <summary>
        /// Gets featured items.
        /// </summary>
        public async Task<ApiResponse<StoreItemsResponse>> GetFeaturedItemsAsync(int limit = 10)
        {
            return await _api.GetAsync<StoreItemsResponse>($"/v1/store/featured?limit={limit}");
        }

        /// <summary>
        /// Gets popular items.
        /// </summary>
        public async Task<ApiResponse<StoreItemsResponse>> GetPopularItemsAsync(int limit = 10)
        {
            return await _api.GetAsync<StoreItemsResponse>($"/v1/store/popular?limit={limit}");
        }

        /// <summary>
        /// Gets all categories.
        /// </summary>
        public async Task<ApiResponse<CategoriesResponse>> GetCategoriesAsync()
        {
            return await _api.GetAsync<CategoriesResponse>("/v1/store/categories");
        }

        /// <summary>
        /// Gets items in a category by slug.
        /// </summary>
        public async Task<ApiResponse<StoreItemsResponse>> GetItemsByCategoryAsync(
            string categorySlug, int limit = 20, int offset = 0)
        {
            return await _api.GetAsync<StoreItemsResponse>(
                $"/v1/store/categories/{categorySlug}/items?limit={limit}&offset={offset}");
        }

        /// <summary>
        /// Searches for items.
        /// </summary>
        public async Task<ApiResponse<SearchResponse>> SearchItemsAsync(
            string query, int limit = 20, int offset = 0)
        {
            var escapedQuery = Uri.EscapeDataString(query);
            return await _api.GetAsync<SearchResponse>(
                $"/v1/store/search?q={escapedQuery}&limit={limit}&offset={offset}");
        }

        // =====================================================================
        // Purchases
        // =====================================================================

        /// <summary>
        /// Initiates a purchase for an item.
        /// Returns a client_secret for Stripe payment if item is not free.
        /// </summary>
        public async Task<ApiResponse<PurchaseResult>> InitiatePurchaseAsync(string itemId)
        {
            var request = new PurchaseRequest { item_id = itemId };
            return await _api.PostAsync<PurchaseResult>("/v1/store/purchase", request);
        }

        /// <summary>
        /// Notifies the companion/mobile client that checkout should continue there.
        /// </summary>
        public async Task<bool> NotifyCompanionForCheckout(string clientSecret, string itemId)
        {
            var response = await _api.PostAsync<object>(
                "/v1/store/checkout/notify",
                new
                {
                    client_secret = clientSecret,
                    item_id = itemId,
                    source = "vr"
                }
            );

            return response != null && response.Success;
        }

        /// <summary>
        /// Gets purchase history.
        /// </summary>
        public async Task<ApiResponse<PurchaseHistoryResponse>> GetPurchaseHistoryAsync(
            int limit = 20, int offset = 0)
        {
            return await _api.GetAsync<PurchaseHistoryResponse>(
                $"/v1/store/purchases?limit={limit}&offset={offset}");
        }

        // =====================================================================
        // Inventory
        // =====================================================================

        /// <summary>
        /// Gets the user's inventory.
        /// </summary>
        public async Task<ApiResponse<InventoryResponse>> GetInventoryAsync(
            ItemType? type = null, int limit = 50, int offset = 0)
        {
            var typeParam = type.HasValue ? $"&type={type.Value.ToString().ToLower()}" : "";
            return await _api.GetAsync<InventoryResponse>(
                $"/v1/inventory?limit={limit}&offset={offset}{typeParam}");
        }

        /// <summary>
        /// Gets currently equipped items.
        /// </summary>
        public async Task<ApiResponse<EquippedItemsResponse>> GetEquippedItemsAsync()
        {
            return await _api.GetAsync<EquippedItemsResponse>("/v1/inventory/equipped");
        }

        /// <summary>
        /// Equips an item.
        /// </summary>
        public async Task<ApiResponse<EquipResponse>> EquipItemAsync(string itemId)
        {
            var request = new EquipRequest { item_id = itemId };
            return await _api.PostAsync<EquipResponse>("/v1/inventory/equip", request);
        }

        /// <summary>
        /// Unequips an item.
        /// </summary>
        public async Task<ApiResponse<EquipResponse>> UnequipItemAsync(string itemId)
        {
            var request = new EquipRequest { item_id = itemId };
            return await _api.PostAsync<EquipResponse>("/v1/inventory/unequip", request);
        }

        /// <summary>
        /// Gets the asset bundle URL for an owned item.
        /// </summary>
        public async Task<ApiResponse<AssetBundleResponse>> GetAssetBundleAsync(string itemId)
        {
            return await _api.GetAsync<AssetBundleResponse>($"/v1/inventory/{itemId}/asset");
        }

        // =====================================================================
        // Creators
        // =====================================================================

        /// <summary>
        /// Gets featured creators.
        /// </summary>
        public async Task<ApiResponse<FeaturedCreatorsResponse>> GetFeaturedCreatorsAsync(int limit = 10)
        {
            return await _api.GetAsync<FeaturedCreatorsResponse>($"/v1/creators/featured?limit={limit}");
        }

        /// <summary>
        /// Gets a creator by ID.
        /// </summary>
        public async Task<ApiResponse<Creator>> GetCreatorAsync(string creatorId)
        {
            return await _api.GetAsync<Creator>($"/v1/creators/{creatorId}");
        }

        /// <summary>
        /// Gets items from a specific creator.
        /// </summary>
        public async Task<ApiResponse<StoreItemsResponse>> GetCreatorItemsAsync(
            string creatorId, int limit = 20, int offset = 0)
        {
            return await _api.GetAsync<StoreItemsResponse>(
                $"/v1/creators/{creatorId}/items?limit={limit}&offset={offset}");
        }

        /// <summary>
        /// Gets the current user's creator account.
        /// </summary>
        public async Task<ApiResponse<Creator>> GetMyCreatorAccountAsync()
        {
            return await _api.GetAsync<Creator>("/v1/creators/me");
        }

        /// <summary>
        /// Creates a creator account.
        /// </summary>
        public async Task<ApiResponse<Creator>> BecomeCreatorAsync(string storeName, string description = null)
        {
            var request = new CreateCreatorRequest
            {
                store_name = storeName,
                description = description
            };
            return await _api.PostAsync<Creator>("/v1/creators", request);
        }

        /// <summary>
        /// Gets earnings summary for the current creator.
        /// </summary>
        public async Task<ApiResponse<EarningsSummary>> GetMyEarningsAsync()
        {
            return await _api.GetAsync<EarningsSummary>("/v1/creators/earnings");
        }
    }
}
