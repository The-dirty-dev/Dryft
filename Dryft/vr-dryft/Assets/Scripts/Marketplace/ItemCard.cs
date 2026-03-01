using System;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TMPro;
using Drift.API;

namespace Drift.Marketplace
{
    /// <summary>
    /// Displays a store item in the grid.
    /// Handles thumbnail loading, pricing display, and click interaction.
    /// </summary>
    public class ItemCard : MonoBehaviour, IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler
    {
        [Header("UI References")]
        [SerializeField] private Image thumbnailImage;
        [SerializeField] private TextMeshProUGUI nameText;
        [SerializeField] private TextMeshProUGUI priceText;
        [SerializeField] private TextMeshProUGUI creatorText;
        [SerializeField] private Image typeIcon;
        [SerializeField] private GameObject ownedBadge;
        [SerializeField] private GameObject featuredBadge;
        [SerializeField] private GameObject ratingContainer;
        [SerializeField] private TextMeshProUGUI ratingText;

        [Header("Visual Feedback")]
        [SerializeField] private Image backgroundImage;
        [SerializeField] private Color normalColor = Color.white;
        [SerializeField] private Color hoverColor = new Color(0.9f, 0.9f, 1f);
        [SerializeField] private Color ownedColor = new Color(0.8f, 1f, 0.8f);

        [Header("Type Icons")]
        [SerializeField] private Sprite avatarIcon;
        [SerializeField] private Sprite outfitIcon;
        [SerializeField] private Sprite toyIcon;
        [SerializeField] private Sprite effectIcon;
        [SerializeField] private Sprite gestureIcon;

        // Events
        public event Action<StoreItem> OnClicked;

        // Data
        private StoreItem _item;
        private bool _isHovered;

        public StoreItem Item => _item;

        /// <summary>
        /// Sets up the card with item data.
        /// </summary>
        public void Setup(StoreItem item)
        {
            _item = item;

            // Name
            if (nameText != null)
                nameText.text = item.name;

            // Price
            if (priceText != null)
                priceText.text = item.FormattedPrice;

            // Creator
            if (creatorText != null)
                creatorText.text = item.creator_name ?? "";

            // Owned badge
            if (ownedBadge != null)
                ownedBadge.SetActive(item.is_owned);

            // Featured badge
            if (featuredBadge != null)
                featuredBadge.SetActive(item.is_featured);

            // Rating
            if (ratingContainer != null && ratingText != null)
            {
                if (item.rating_count > 0)
                {
                    ratingContainer.SetActive(true);
                    ratingText.text = $"{item.rating:F1}";
                }
                else
                {
                    ratingContainer.SetActive(false);
                }
            }

            // Type icon
            if (typeIcon != null)
            {
                typeIcon.sprite = GetTypeIcon(item.ItemType);
            }

            // Background color
            UpdateBackgroundColor();

            // Load thumbnail
            if (!string.IsNullOrEmpty(item.thumbnail_url))
            {
                _ = LoadThumbnailAsync(item.thumbnail_url);
            }
        }

        private Sprite GetTypeIcon(ItemType type)
        {
            return type switch
            {
                ItemType.Avatar => avatarIcon,
                ItemType.Outfit => outfitIcon,
                ItemType.Toy => toyIcon,
                ItemType.Effect => effectIcon,
                ItemType.Gesture => gestureIcon,
                _ => avatarIcon
            };
        }

        private void UpdateBackgroundColor()
        {
            if (backgroundImage == null) return;

            if (_item != null && _item.is_owned)
            {
                backgroundImage.color = ownedColor;
            }
            else if (_isHovered)
            {
                backgroundImage.color = hoverColor;
            }
            else
            {
                backgroundImage.color = normalColor;
            }
        }

        private async Task LoadThumbnailAsync(string url)
        {
            if (thumbnailImage == null) return;

            try
            {
                using var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                // Check if destroyed during load
                if (this == null || thumbnailImage == null) return;

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    thumbnailImage.sprite = Sprite.Create(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                        new Vector2(0.5f, 0.5f));
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ItemCard] Failed to load thumbnail: {ex.Message}");
            }
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (_item != null)
            {
                OnClicked?.Invoke(_item);
            }
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            _isHovered = true;
            UpdateBackgroundColor();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            _isHovered = false;
            UpdateBackgroundColor();
        }

        /// <summary>
        /// Updates the owned status of the card.
        /// </summary>
        public void SetOwned(bool owned)
        {
            if (_item != null)
            {
                _item.is_owned = owned;
            }

            if (ownedBadge != null)
                ownedBadge.SetActive(owned);

            UpdateBackgroundColor();
        }
    }
}
