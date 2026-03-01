package agegate

import (
	"context"
	"fmt"

	"github.com/dryft-app/backend/internal/config"
)

// FaceMatchService handles face comparison between ID selfie and profile photo.
// LEGAL NOTE: Face comparison is used to prevent identity fraud - ensuring the
// person who verified their ID is the same person using the profile. This is
// a critical security measure for age-verified platforms.
type FaceMatchService struct {
	cfg *config.Config
}

func NewFaceMatchService(cfg *config.Config) *FaceMatchService {
	return &FaceMatchService{cfg: cfg}
}

// FaceMatchResult contains the comparison result
type FaceMatchResult struct {
	Score       float64 // 0.0 to 1.0
	Passed      bool
	Method      string // "jumio" or "rekognition"
	NeedsReview bool   // True if score is in manual review range
	Error       string
}

// CompareFromJumio uses Jumio's built-in face similarity result.
// This is the primary method - Jumio already compared the ID selfie
// against the document photo during their verification.
func (f *FaceMatchService) CompareFromJumio(jumioSimilarityScore float64) *FaceMatchResult {
	result := &FaceMatchResult{
		Score:  jumioSimilarityScore,
		Method: "jumio",
	}

	// Handle special case where Jumio couldn't compare
	if jumioSimilarityScore < 0 {
		result.NeedsReview = true
		result.Error = "Face comparison not possible - manual review required"
		return result
	}

	// Check against thresholds
	if jumioSimilarityScore >= f.cfg.FaceMatchThreshold {
		result.Passed = true
	} else if jumioSimilarityScore >= f.cfg.FaceMatchManualReviewMin {
		result.NeedsReview = true
	}

	return result
}

// CompareWithRekognition uses AWS Rekognition as a fallback or additional check.
// This compares the user's profile photo against the Jumio verification selfie.
// LEGAL NOTE: Requires user consent for biometric data processing in some jurisdictions.
func (f *FaceMatchService) CompareWithRekognition(ctx context.Context, profilePhotoS3Key, jumioSelfieURL string) (*FaceMatchResult, error) {
	result := &FaceMatchResult{
		Method: "rekognition",
	}

	// Skip in development if no AWS credentials
	if f.cfg.IsDevelopment() && f.cfg.AWSAccessKeyID == "" {
		result.Score = 0.95 // Mock score for dev
		result.Passed = true
		return result, nil
	}

	// AWS Rekognition integration would go here
	// Using the CompareFaces API:
	//
	// client := rekognition.NewFromConfig(awsCfg)
	// output, err := client.CompareFaces(ctx, &rekognition.CompareFacesInput{
	//     SourceImage: &types.Image{
	//         S3Object: &types.S3Object{
	//             Bucket: aws.String(bucket),
	//             Name:   aws.String(profilePhotoS3Key),
	//         },
	//     },
	//     TargetImage: &types.Image{
	//         Bytes: jumioSelfieBytes, // Fetched from Jumio
	//     },
	//     SimilarityThreshold: aws.Float32(float32(f.cfg.FaceMatchManualReviewMin * 100)),
	// })

	// For now, return error indicating Rekognition needs to be implemented
	return nil, fmt.Errorf("rekognition integration not implemented - use Jumio similarity")
}

// DetermineVerificationOutcome decides the final verification status based on all checks.
// LEGAL NOTE: This is where we make the final age verification decision.
// The logic must be auditable and consistent.
func (f *FaceMatchService) DetermineVerificationOutcome(
	cardVerified bool,
	idVerified bool,
	isAdult bool,
	faceMatch *FaceMatchResult,
) VerificationOutcome {

	outcome := VerificationOutcome{
		Status: "PENDING",
	}

	// Must have card verified
	if !cardVerified {
		outcome.Status = "PENDING"
		outcome.Reason = "Card verification required"
		return outcome
	}

	// Must have ID verified
	if !idVerified {
		outcome.Status = "PENDING"
		outcome.Reason = "ID verification required"
		return outcome
	}

	// Must be 18+
	if !isAdult {
		outcome.Status = "REJECTED"
		outcome.Reason = "Must be 18 years or older"
		return outcome
	}

	// Check face match
	if faceMatch == nil {
		outcome.Status = "PENDING"
		outcome.Reason = "Face verification required"
		return outcome
	}

	if faceMatch.NeedsReview {
		outcome.Status = "MANUAL_REVIEW"
		outcome.Reason = "Face match requires manual review"
		return outcome
	}

	if !faceMatch.Passed {
		outcome.Status = "REJECTED"
		outcome.Reason = "Face verification failed - profile photo does not match ID"
		return outcome
	}

	// All checks passed
	outcome.Status = "VERIFIED"
	return outcome
}

// VerificationOutcome is the final determination
type VerificationOutcome struct {
	Status string // PENDING, VERIFIED, REJECTED, MANUAL_REVIEW
	Reason string
}
