using Drift.Haptics;
using NUnit.Framework;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class HapticPatternsTests
    {
        [Test]
        public void GetByName_ReturnsKnownPatternCaseInsensitive()
        {
            var pattern = HapticPatternLibrary.GetByName("fOrEpLaY");

            Assert.IsNotNull(pattern);
            Assert.AreEqual("Foreplay", pattern.Name);
            Assert.IsTrue(pattern.Loop);
        }

        [Test]
        public void GetByName_UnknownPattern_ReturnsNull()
        {
            var pattern = HapticPatternLibrary.GetByName("not-real");

            Assert.IsNull(pattern);
        }

        [Test]
        public void HapticStep_Constructor_ClampsIntensityAndDuration()
        {
            var low = new HapticStep(-2f, -1f);
            var high = new HapticStep(3f, 1.5f);

            Assert.AreEqual(0f, low.Intensity, 0.0001f);
            Assert.AreEqual(0f, low.DurationSeconds, 0.0001f);
            Assert.AreEqual(1f, high.Intensity, 0.0001f);
            Assert.AreEqual(1.5f, high.DurationSeconds, 0.0001f);
        }

        [Test]
        public void BuiltInPatterns_HaveNonNegativeStepDurations()
        {
            foreach (var name in HapticPatternLibrary.AllPatternNames)
            {
                var pattern = HapticPatternLibrary.GetByName(name);
                Assert.IsNotNull(pattern, $"Pattern '{name}' should resolve");
                Assert.IsNotNull(pattern.Steps);
                Assert.IsNotEmpty(pattern.Steps);

                foreach (var step in pattern.Steps)
                {
                    Assert.GreaterOrEqual(step.DurationSeconds, 0f, $"Pattern '{name}' has negative duration");
                }
            }
        }
    }
}
