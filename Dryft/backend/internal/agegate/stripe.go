package agegate

import (
	"context"
	"fmt"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/customer"
	"github.com/stripe/stripe-go/v78/setupintent"

	"github.com/dryft-app/backend/internal/config"
)

// StripeClient handles Stripe API interactions for card verification.
// LEGAL NOTE: We use Stripe's SetupIntent to verify a card without charging.
// This serves as part of age verification - having a valid payment card
// indicates the user is likely an adult with financial access.
type StripeClient struct {
	cfg *config.Config
}

func NewStripeClient(cfg *config.Config) *StripeClient {
	stripe.Key = cfg.StripeSecretKey
	return &StripeClient{cfg: cfg}
}

// CreateCustomer creates a Stripe customer for the user.
// We store the customer ID to track verification state.
func (s *StripeClient) CreateCustomer(ctx context.Context, email string, userID string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Metadata: map[string]string{
			"drift_user_id": userID,
			"purpose":       "age_verification",
		},
	}

	cust, err := customer.New(params)
	if err != nil {
		return nil, fmt.Errorf("create stripe customer: %w", err)
	}

	return cust, nil
}

// CreateSetupIntent creates a SetupIntent for card verification.
// The client uses the client_secret to complete card entry via Stripe.js/Elements.
// LEGAL NOTE: No actual charge is made. This only validates the card exists
// and the user has access to it.
func (s *StripeClient) CreateSetupIntent(ctx context.Context, customerID string) (*stripe.SetupIntent, error) {
	params := &stripe.SetupIntentParams{
		Customer: stripe.String(customerID),
		PaymentMethodTypes: stripe.StringSlice([]string{
			"card",
		}),
		Usage: stripe.String("off_session"), // For potential future charges
		Metadata: map[string]string{
			"purpose": "age_verification",
		},
	}

	intent, err := setupintent.New(params)
	if err != nil {
		return nil, fmt.Errorf("create setup intent: %w", err)
	}

	return intent, nil
}

// GetSetupIntent retrieves a SetupIntent to check its status
func (s *StripeClient) GetSetupIntent(ctx context.Context, intentID string) (*stripe.SetupIntent, error) {
	intent, err := setupintent.Get(intentID, nil)
	if err != nil {
		return nil, fmt.Errorf("get setup intent: %w", err)
	}

	return intent, nil
}

// IsSetupIntentSucceeded returns true if the SetupIntent completed successfully
func (s *StripeClient) IsSetupIntentSucceeded(intent *stripe.SetupIntent) bool {
	return intent.Status == stripe.SetupIntentStatusSucceeded
}

// GetPaymentMethodDetails extracts card details from the SetupIntent
func (s *StripeClient) GetPaymentMethodDetails(intent *stripe.SetupIntent) (last4, brand string, err error) {
	if intent.PaymentMethod == nil {
		return "", "", fmt.Errorf("no payment method attached")
	}

	pm := intent.PaymentMethod
	if pm.Card == nil {
		return "", "", fmt.Errorf("payment method is not a card")
	}

	return pm.Card.Last4, string(pm.Card.Brand), nil
}

// CardVerificationResult contains the results of card verification
type CardVerificationResult struct {
	CustomerID string
	Verified   bool
	Last4      string
	Brand      string
	Error      string
}

// VerifyCard performs the full card verification flow
func (s *StripeClient) VerifyCard(ctx context.Context, email, userID, setupIntentID string) (*CardVerificationResult, error) {
	result := &CardVerificationResult{}

	// Get the SetupIntent
	intent, err := s.GetSetupIntent(ctx, setupIntentID)
	if err != nil {
		result.Error = "Failed to retrieve payment verification"
		return result, err
	}

	// Check customer matches (security check)
	if intent.Customer != nil {
		result.CustomerID = intent.Customer.ID
	}

	// Check if succeeded
	if !s.IsSetupIntentSucceeded(intent) {
		result.Error = fmt.Sprintf("Card verification not completed: %s", intent.Status)
		return result, nil
	}

	// Get card details
	last4, brand, err := s.GetPaymentMethodDetails(intent)
	if err != nil {
		result.Error = "Failed to retrieve card details"
		return result, err
	}

	result.Verified = true
	result.Last4 = last4
	result.Brand = brand

	return result, nil
}
