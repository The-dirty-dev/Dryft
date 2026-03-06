using System;
using System.Collections.Generic;
using System.Reflection;
using Drift.API;
using Drift.Marketplace;
using NUnit.Framework;
using UnityEngine;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class InventoryManagerTests
    {
        private GameObject _gameObject;
        private InventoryManager _manager;

        [SetUp]
        public void SetUp()
        {
            _gameObject = new GameObject("InventoryManagerTest");
            _manager = _gameObject.AddComponent<InventoryManager>();
        }

        [TearDown]
        public void TearDown()
        {
            if (_gameObject != null)
            {
                UnityEngine.Object.DestroyImmediate(_gameObject);
            }
        }

        [Test]
        public void AddToInventory_AddsItemAndOwnershipLookup()
        {
            var item = BuildInventoryItem("item-1", "Neon Jacket", "outfit");

            _manager.AddToInventory(item);

            Assert.IsTrue(_manager.OwnsItem("item-1"));
            Assert.AreEqual(item, _manager.GetItem("item-1"));
            Assert.AreEqual(1, _manager.Items.Count);
        }

        [Test]
        public void AddToInventory_DuplicateItem_IsIgnored()
        {
            var item = BuildInventoryItem("item-2", "Pink Aura", "effect");

            _manager.AddToInventory(item);
            _manager.AddToInventory(item);

            Assert.AreEqual(1, _manager.Items.Count);
        }

        [Test]
        public void GetItemsByType_ReturnsOnlyMatchingType()
        {
            _manager.AddToInventory(BuildInventoryItem("item-3", "Avatar A", "avatar"));
            _manager.AddToInventory(BuildInventoryItem("item-4", "Outfit A", "outfit"));

            var outfits = _manager.GetItemsByType(ItemType.Outfit);
            var avatars = _manager.GetItemsByType(ItemType.Avatar);

            Assert.AreEqual(1, outfits.Count);
            Assert.AreEqual("item-4", outfits[0].item_id);
            Assert.AreEqual(1, avatars.Count);
            Assert.AreEqual("item-3", avatars[0].item_id);
        }

        [Test]
        public void NeedsRefresh_TrueWhenNeverFetched()
        {
            Assert.IsTrue(_manager.NeedsRefresh());
        }

        [Test]
        public void NeedsRefresh_FalseWhenCacheIsFresh()
        {
            SetPrivateField(_manager, "_lastFetchTime", DateTime.Now);

            Assert.IsFalse(_manager.NeedsRefresh());
        }

        [Test]
        public void GetEquippedItem_ReturnsTrackedItem()
        {
            var equipped = BuildInventoryItem("item-5", "Ring", "effect");
            equipped.is_equipped = true;

            var map = new Dictionary<ItemType, InventoryItem>
            {
                [ItemType.Effect] = equipped,
            };

            SetPrivateField(_manager, "_equippedByType", map);

            var result = _manager.GetEquippedItem(ItemType.Effect);

            Assert.IsNotNull(result);
            Assert.AreEqual("item-5", result.item_id);
        }

        private static InventoryItem BuildInventoryItem(string id, string name, string type)
        {
            return new InventoryItem
            {
                item_id = id,
                is_equipped = false,
                item = new StoreItem
                {
                    id = id,
                    name = name,
                    type = type,
                    price = 500,
                },
            };
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.IsNotNull(field, $"Expected private field '{fieldName}' to exist");
            field.SetValue(target, value);
        }
    }
}
