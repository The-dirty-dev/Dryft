using UnityEngine;
using Drift.Player;

namespace Drift.Environment.Interactables
{
    /// <summary>
    /// Seat interactable - allows players to sit.
    /// </summary>
    public class Seat : InteractableObject
    {
        [Header("Seat Settings")]
        [SerializeField] private Transform _sitPoint;
        [SerializeField] private Transform _sitLookAt;
        [SerializeField] private bool _isOccupied;
        [SerializeField] private SeatType _seatType = SeatType.Chair;

        [Header("Animation")]
        [SerializeField] private float _sitTransitionTime = 0.5f;

        // State
        public bool IsOccupied => _isOccupied;
        public string OccupantId { get; private set; }

        // Network sync would track occupancy

        protected override void Start()
        {
            base.Start();

            // Update prompt based on seat type
            var prompt = _seatType == SeatType.Couch ? "Sit on couch" :
                         _seatType == SeatType.Barstool ? "Sit at bar" : "Sit";
        }

        public override void Interact()
        {
            if (!CanInteract || _isOccupied) return;

            base.Interact();
            SitDown();
        }

        private void SitDown()
        {
            if (PlayerController.Instance == null || _sitPoint == null) return;

            _isOccupied = true;
            OccupantId = Core.GameManager.Instance?.UserId;

            // Move player to sit point
            Vector3 targetPos = _sitPoint.position;
            Quaternion targetRot = _sitLookAt != null
                ? Quaternion.LookRotation(_sitLookAt.position - _sitPoint.position)
                : _sitPoint.rotation;

            PlayerController.Instance.SitAt(targetPos, targetRot, _sitTransitionTime);
            PlayerController.Instance.OnStandUp += HandleStandUp;

            Debug.Log($"[Seat] Player sat at: {gameObject.name}");
        }

        private void HandleStandUp()
        {
            _isOccupied = false;
            OccupantId = null;
            PlayerController.Instance.OnStandUp -= HandleStandUp;

            Debug.Log($"[Seat] Player stood up from: {gameObject.name}");
        }

        /// <summary>
        /// Force vacate (e.g., when seat is removed or reset).
        /// </summary>
        public void ForceVacate()
        {
            if (!_isOccupied) return;

            // Make player stand
            if (PlayerController.Instance != null && OccupantId == Core.GameManager.Instance?.UserId)
            {
                PlayerController.Instance.StandUp();
            }

            _isOccupied = false;
            OccupantId = null;
        }

        private void OnDrawGizmos()
        {
            if (_sitPoint != null)
            {
                Gizmos.color = _isOccupied ? Color.red : Color.green;
                Gizmos.DrawWireSphere(_sitPoint.position, 0.2f);

                if (_sitLookAt != null)
                {
                    Gizmos.color = Color.blue;
                    Gizmos.DrawLine(_sitPoint.position, _sitLookAt.position);
                }
            }
        }
    }

    public enum SeatType
    {
        Chair,
        Couch,
        Barstool,
        Booth
    }
}
