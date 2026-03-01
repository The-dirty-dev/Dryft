package verification

import (
	"context"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

// SESEmailService sends verification emails via Amazon SES.
type SESEmailService struct {
	client    *sesv2.Client
	fromEmail string
}

// NewSESEmailService creates an SES-backed email sender.
func NewSESEmailService(region, accessKeyID, secretAccessKey, fromEmail string) (*SESEmailService, error) {
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			accessKeyID, secretAccessKey, "",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load AWS config for SES: %w", err)
	}

	return &SESEmailService{
		client:    sesv2.NewFromConfig(cfg),
		fromEmail: fromEmail,
	}, nil
}

func (s *SESEmailService) SendVerificationEmail(ctx context.Context, email, code string) error {
	subject := "Drift — Verify Your Email"
	body := fmt.Sprintf(
		"Your Drift verification code is: %s\n\nThis code expires in 15 minutes. If you didn't request this, you can safely ignore this email.",
		code,
	)

	_, err := s.client.SendEmail(ctx, &sesv2.SendEmailInput{
		FromEmailAddress: &s.fromEmail,
		Destination: &types.Destination{
			ToAddresses: []string{email},
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{Data: &subject},
				Body: &types.Body{
					Text: &types.Content{Data: &body},
				},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("send verification email via SES: %w", err)
	}

	return nil
}
