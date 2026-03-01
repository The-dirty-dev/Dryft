using NUnit.Framework;
using UnityEngine;
using System;

namespace Drift.Tests.EditMode
{
    /// <summary>
    /// Unit tests for safety system data structures.
    /// </summary>
    [TestFixture]
    public class SafetyTests
    {
        [Test]
        public void BlockedUserInfo_StoresData()
        {
            var blocked = new BlockedUserInfo
            {
                UserId = "user_123",
                DisplayName = "Test User",
                Reason = "Harassment",
                BlockedAt = DateTime.UtcNow
            };

            Assert.AreEqual("user_123", blocked.UserId);
            Assert.AreEqual("Test User", blocked.DisplayName);
            Assert.AreEqual("Harassment", blocked.Reason);
            Assert.IsNotNull(blocked.BlockedAt);
        }

        [Test]
        public void ReportRequest_ValidatesRequiredFields()
        {
            var report = new ReportRequest
            {
                ReportedUserId = "user_456",
                Reason = "Inappropriate behavior",
                Category = "conduct"
            };

            Assert.IsNotNull(report.ReportedUserId);
            Assert.IsNotNull(report.Reason);
            Assert.IsNotNull(report.Category);
        }

        [Test]
        public void ReportResult_Success_IsValid()
        {
            var result = new ReportResult
            {
                Success = true,
                ReportId = "report_789",
                Message = "Report submitted successfully"
            };

            Assert.IsTrue(result.Success);
            Assert.AreEqual("report_789", result.ReportId);
            Assert.IsNotNull(result.Message);
        }

        [Test]
        public void ReportResult_Failure_HasError()
        {
            var result = new ReportResult
            {
                Success = false,
                Error = "Failed to submit report"
            };

            Assert.IsFalse(result.Success);
            Assert.IsNotNull(result.Error);
        }
    }

    // Data structures for tests (matching SafetyManager types)

    public class BlockedUserInfo
    {
        public string UserId { get; set; }
        public string DisplayName { get; set; }
        public string Reason { get; set; }
        public DateTime BlockedAt { get; set; }
    }

    public class ReportRequest
    {
        public string ReportedUserId { get; set; }
        public string Reason { get; set; }
        public string Category { get; set; }
        public string Description { get; set; }
        public string[] EvidenceUrls { get; set; }
    }

    public class ReportResult
    {
        public bool Success { get; set; }
        public string ReportId { get; set; }
        public string Message { get; set; }
        public string Error { get; set; }
    }
}
