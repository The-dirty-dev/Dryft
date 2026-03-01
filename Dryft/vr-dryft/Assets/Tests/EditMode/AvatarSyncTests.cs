using NUnit.Framework;
using UnityEngine;
using Drift.Avatar;
using Drift.Player;

namespace Drift.Tests.EditMode
{
    /// <summary>
    /// Unit tests for avatar synchronization system.
    /// </summary>
    [TestFixture]
    public class AvatarSyncTests
    {
        [Test]
        public void AvatarState_DefaultValues_AreCorrect()
        {
            var state = new AvatarState();

            Assert.IsNull(state.AvatarId);
            Assert.IsNull(state.OutfitId);
            Assert.IsNull(state.EffectId);
            Assert.AreEqual(Color.white, state.SkinTone);
            Assert.AreEqual(Color.black, state.HairColor);
            Assert.AreEqual(Color.blue, state.EyeColor);
        }

        [Test]
        public void AvatarState_CanSetValues()
        {
            var state = new AvatarState
            {
                AvatarId = "avatar_001",
                OutfitId = "outfit_001",
                EffectId = "effect_001",
                SkinTone = Color.red,
                HairColor = Color.yellow,
                EyeColor = Color.green
            };

            Assert.AreEqual("avatar_001", state.AvatarId);
            Assert.AreEqual("outfit_001", state.OutfitId);
            Assert.AreEqual("effect_001", state.EffectId);
            Assert.AreEqual(Color.red, state.SkinTone);
            Assert.AreEqual(Color.yellow, state.HairColor);
            Assert.AreEqual(Color.green, state.EyeColor);
        }

        [Test]
        public void ColorToHex_ConvertsCorrectly()
        {
            var color = new Color(1f, 0f, 0f, 1f); // Red
            var hex = ColorUtility.ToHtmlStringRGBA(color);

            Assert.AreEqual("FF0000FF", hex);
        }

        [Test]
        public void HexToColor_ParsesCorrectly()
        {
            ColorUtility.TryParseHtmlString("#FF0000FF", out Color color);

            Assert.AreEqual(1f, color.r, 0.01f);
            Assert.AreEqual(0f, color.g, 0.01f);
            Assert.AreEqual(0f, color.b, 0.01f);
            Assert.AreEqual(1f, color.a, 0.01f);
        }
    }

    /// <summary>
    /// Unit tests for avatar parts enum.
    /// </summary>
    [TestFixture]
    public class AvatarPartTests
    {
        [Test]
        public void AvatarPart_HasExpectedValues()
        {
            Assert.AreEqual(0, (int)AvatarPart.Head);
            Assert.AreEqual(1, (int)AvatarPart.LeftHand);
            Assert.AreEqual(2, (int)AvatarPart.RightHand);
            Assert.AreEqual(3, (int)AvatarPart.Body);
        }
    }
}
