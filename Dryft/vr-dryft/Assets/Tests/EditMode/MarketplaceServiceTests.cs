using System;
using Drift.API;
using Drift.Marketplace;
using NUnit.Framework;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class MarketplaceServiceTests
    {
        [Test]
        public void MarketplaceService_Instance_IsSingleton()
        {
            Assert.AreSame(MarketplaceService.Instance, MarketplaceService.Instance);
        }

        [Test]
        public void StoreItem_FormattedPrice_HandlesFreeAndPaidItems()
        {
            var free = new StoreItem { price = 0 };
            var paid = new StoreItem { price = 1299 };

            Assert.AreEqual("Free", free.FormattedPrice);
            Assert.AreEqual("$12.99", paid.FormattedPrice);
        }

        [Test]
        public void StoreItem_ItemType_ParsesKnownAndUnknownValues()
        {
            var outfit = new StoreItem { type = "Outfit" };
            var unknown = new StoreItem { type = "not-a-type" };

            Assert.AreEqual(ItemType.Outfit, outfit.ItemType);
            Assert.AreEqual(ItemType.Avatar, unknown.ItemType);
        }

        [Test]
        public void PurchaseResult_IsFree_WhenAmountIsZero()
        {
            Assert.IsTrue(new PurchaseResult { amount = 0 }.IsFree);
            Assert.IsFalse(new PurchaseResult { amount = 1 }.IsFree);
        }

        [Test]
        public void SearchItemsAsync_NullQuery_ThrowsArgumentNullException()
        {
            var service = new MarketplaceService();

            Assert.ThrowsAsync<ArgumentNullException>(async () => await service.SearchItemsAsync(null));
        }
    }
}
