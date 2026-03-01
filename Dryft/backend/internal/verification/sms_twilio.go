package verification

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// TwilioSMSService sends SMS messages via the Twilio REST API.
type TwilioSMSService struct {
	accountSID string
	authToken  string
	fromNumber string
	httpClient *http.Client
}

// NewTwilioSMSService creates a Twilio-backed SMS sender.
func NewTwilioSMSService(accountSID, authToken, fromNumber string) *TwilioSMSService {
	return &TwilioSMSService{
		accountSID: accountSID,
		authToken:  authToken,
		fromNumber: fromNumber,
		httpClient: &http.Client{},
	}
}

func (t *TwilioSMSService) Send(ctx context.Context, phoneNumber, message string) error {
	apiURL := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", t.accountSID)

	data := url.Values{}
	data.Set("To", phoneNumber)
	data.Set("From", t.fromNumber)
	data.Set("Body", message)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, strings.NewReader(data.Encode()))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.SetBasicAuth(t.accountSID, t.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send SMS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("twilio returned status %d", resp.StatusCode)
	}

	return nil
}
