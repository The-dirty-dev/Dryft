using System;
using System.Collections.Generic;

namespace Drift.API
{
    // ==========================================================================
    // Store Items
    // ==========================================================================

    /// <summary>
    /// Types of items available in the marketplace.
    /// </summary>
    public enum ItemType
    {
        Avatar,
        Outfit,
        Toy,
        Effect,
        Gesture
    }

    /// <summary>
    /// Status of a store item.
    /// </summary>
    public enum ItemStatus
    {
        Draft,
        Pending,
        Approved,
        Rejected,
        Disabled
    }

    /// <summary>
    /// A store item as returned by the API.
    /// </summary>
    [Serializable]
    public class StoreItem
    {
        public string id;
        public string creator_id;
        public string creator_name;
        public string type;
        public string name;
        public string description;
        public long price;           // In cents
        public string currency;
        public string thumbnail_url;
        public string preview_url;
        public string[] tags;
        public long purchase_count;
        public float rating;
        public long rating_count;
        public bool is_featured;
        public bool is_owned;

        /// <summary>
        /// Gets the price in dollars/euros.
        /// </summary>
        public float PriceInDollars => price / 100f;

        /// <summary>
        /// Gets formatted price string.
        /// </summary>
        public string FormattedPrice
        {
            get
            {
                if (price == 0) return "Free";
                return $"${PriceInDollars:F2}";
            }
        }

        /// <summary>
        /// Gets the item type as enum.
        /// </summary>
        public ItemType ItemType
        {
            get
            {
                return type?.ToLower() switch
                {
                    "avatar" => ItemType.Avatar,
                    "outfit" => ItemType.Outfit,
                    "toy" => ItemType.Toy,
                    "effect" => ItemType.Effect,
                    "gesture" => ItemType.Gesture,
                    _ => ItemType.Avatar
                };
            }
        }
    }

    /// <summary>
    /// Response containing a list of store items.
    /// </summary>
    [Serializable]
    public class StoreItemsResponse
    {
        public StoreItem[] items;
        public int total;
        public int limit;
        public int offset;
    }

    /// <summary>
    /// Response containing a single store item.
    /// </summary>
    [Serializable]
    public class StoreItemResponse
    {
        public StoreItem item;
    }

    /// <summary>
    /// Search response.
    /// </summary>
    [Serializable]
    public class SearchResponse
    {
        public StoreItem[] items;
        public int total;
        public string query;
        public int limit;
        public int offset;
    }

    // ==========================================================================
    // Categories
    // ==========================================================================

    /// <summary>
    /// Item category.
    /// </summary>
    [Serializable]
    public class ItemCategory
    {
        public string id;
        public string name;
        public string slug;
        public string description;
        public string parent_id;
        public int sort_order;
        public string icon_url;
    }

    /// <summary>
    /// Response containing categories.
    /// </summary>
    [Serializable]
    public class CategoriesResponse
    {
        public ItemCategory[] categories;
    }

    // ==========================================================================
    // Inventory
    // ==========================================================================

    /// <summary>
    /// An item in the user's inventory.
    /// </summary>
    [Serializable]
    public class InventoryItem
    {
        public string id;
        public string user_id;
        public string item_id;
        public string purchase_id;
        public bool is_equipped;
        public string acquired_at;
        public StoreItem item;
    }

    /// <summary>
    /// Response containing inventory items.
    /// </summary>
    [Serializable]
    public class InventoryResponse
    {
        public InventoryItem[] items;
        public int limit;
        public int offset;
    }

    /// <summary>
    /// Response containing equipped items.
    /// </summary>
    [Serializable]
    public class EquippedItemsResponse
    {
        public InventoryItem[] items;
    }

    /// <summary>
    /// Request to equip/unequip an item.
    /// </summary>
    [Serializable]
    public class EquipRequest
    {
        public string item_id;
    }

    /// <summary>
    /// Response after equipping an item.
    /// </summary>
    [Serializable]
    public class EquipResponse
    {
        public string status;
    }

    /// <summary>
    /// Response containing an asset bundle URL.
    /// </summary>
    [Serializable]
    public class AssetBundleResponse
    {
        public string asset_bundle;
    }

    // ==========================================================================
    // Purchases
    // ==========================================================================

    /// <summary>
    /// Request to purchase an item.
    /// </summary>
    [Serializable]
    public class PurchaseRequest
    {
        public string item_id;
    }

    /// <summary>
    /// Result of initiating a purchase.
    /// </summary>
    [Serializable]
    public class PurchaseResult
    {
        public string purchase_id;
        public string client_secret;  // For Stripe
        public long amount;
        public string currency;

        /// <summary>
        /// True if this was a free item (already acquired).
        /// </summary>
        public bool IsFree => amount == 0;
    }

    /// <summary>
    /// Purchase status.
    /// </summary>
    public enum PurchaseStatus
    {
        Pending,
        Completed,
        Refunded,
        Failed
    }

    /// <summary>
    /// A purchase record.
    /// </summary>
    [Serializable]
    public class Purchase
    {
        public string id;
        public string buyer_id;
        public string item_id;
        public string creator_id;
        public long amount;
        public string currency;
        public string status;
        public string created_at;

        public PurchaseStatus Status
        {
            get
            {
                return status?.ToLower() switch
                {
                    "pending" => PurchaseStatus.Pending,
                    "completed" => PurchaseStatus.Completed,
                    "refunded" => PurchaseStatus.Refunded,
                    "failed" => PurchaseStatus.Failed,
                    _ => PurchaseStatus.Pending
                };
            }
        }
    }

    /// <summary>
    /// Response containing purchase history.
    /// </summary>
    [Serializable]
    public class PurchaseHistoryResponse
    {
        public Purchase[] purchases;
        public int limit;
        public int offset;
    }

    // ==========================================================================
    // Creators
    // ==========================================================================

    /// <summary>
    /// A creator account.
    /// </summary>
    [Serializable]
    public class Creator
    {
        public string id;
        public string user_id;
        public string store_name;
        public string description;
        public string logo_url;
        public string banner_url;
        public bool stripe_onboarded;
        public bool payouts_enabled;
        public long total_sales;
        public long total_earnings;
        public int item_count;
        public float rating;
        public long rating_count;
        public bool is_verified;
        public bool is_featured;
        public string created_at;
    }

    /// <summary>
    /// Response containing featured creators.
    /// </summary>
    [Serializable]
    public class FeaturedCreatorsResponse
    {
        public Creator[] creators;
    }

    /// <summary>
    /// Request to become a creator.
    /// </summary>
    [Serializable]
    public class CreateCreatorRequest
    {
        public string store_name;
        public string description;
    }

    /// <summary>
    /// Request for Stripe onboarding link.
    /// </summary>
    [Serializable]
    public class OnboardingLinkRequest
    {
        public string return_url;
        public string refresh_url;
    }

    /// <summary>
    /// Response containing onboarding link.
    /// </summary>
    [Serializable]
    public class OnboardingLinkResponse
    {
        public string url;
    }

    /// <summary>
    /// Earnings summary for a creator.
    /// </summary>
    [Serializable]
    public class EarningsSummary
    {
        public long total_earnings;
        public long total_paid_out;
        public long available_balance;
        public long last_30_days;
        public long last_7_days;
        public long total_sales;

        public float TotalEarningsInDollars => total_earnings / 100f;
        public float AvailableBalanceInDollars => available_balance / 100f;
        public float Last30DaysInDollars => last_30_days / 100f;
        public float Last7DaysInDollars => last_7_days / 100f;
    }
}
