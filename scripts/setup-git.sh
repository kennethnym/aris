#!/bin/bash

# Git setup script
# Sets up user info, email, and credential helpers with Gitea access token

set -e

echo "Setting up Git configuration..."

# Check if required environment variables are set
if [ -z "$GIT_USER" ]; then
    echo "Error: GIT_USER environment variable is not set"
    exit 1
fi

if [ -z "$GIT_EMAIL" ]; then
    echo "Error: GIT_EMAIL environment variable is not set"
    exit 1
fi

# Set user name and email from environment variables
git config --global user.name "$GIT_USER"
git config --global user.email "$GIT_EMAIL"

# Set up credential helper for HTTPS authentication
git config --global credential.helper store

# Check if GITEA_ACCESS_TOKEN is set
if [ -z "$GITEA_ACCESS_TOKEN" ]; then
    echo "Warning: GITEA_ACCESS_TOKEN environment variable is not set"
    echo "You'll need to set this environment variable for automatic authentication"
    exit 1
fi

# Set up credential store with the access token
# This assumes your Gitea instance is accessible via HTTPS
# Adjust the URL pattern to match your Gitea instance
echo "Setting up credential store..."

# Create credentials file if it doesn't exist
CREDENTIAL_FILE="$HOME/.git-credentials"
touch "$CREDENTIAL_FILE"
chmod 600 "$CREDENTIAL_FILE"

# Add Gitea credentials (adjust URL to match your Gitea instance)
# Format: https://username:token@gitea.example.com
# Using the token as both username and password is common for API tokens
echo "https://$GITEA_USERNAME:$GITEA_ACCESS_TOKEN@code.nym.sh" >> "$CREDENTIAL_FILE"

# Additional Git configurations for better experience
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global push.default simple
git config --global core.autocrlf input

echo "Git configuration completed successfully!"
echo "User: $(git config --global user.name)"
echo "Email: $(git config --global user.email)"
echo "Credential helper: $(git config --global credential.helper)"

# Verify setup by testing credential access (optional)
echo "Git setup complete. Credentials are stored for automatic authentication."

# GPG key setup
echo ""
echo "Setting up GPG key for commit signing..."

if [ -n "$GPG_PRIVATE_KEY" ]; then
    echo "Importing GPG private key from environment variable..."
    
    # Import the private key with passphrase if provided
    if [ -n "$GPG_PRIVATE_KEY_PASSPHRASE" ]; then
        echo "Using provided passphrase for key import..."
        # Create temporary file for the key
        TEMP_KEY_FILE=$(mktemp)
        echo -e "$GPG_PRIVATE_KEY" > "$TEMP_KEY_FILE"
        chmod 600 "$TEMP_KEY_FILE"
        gpg --batch --yes --pinentry-mode loopback --passphrase "$GPG_PRIVATE_KEY_PASSPHRASE" --import "$TEMP_KEY_FILE"
        rm -f "$TEMP_KEY_FILE"
    else
        echo "No passphrase provided, importing key..."
        # Create temporary file for the key
        TEMP_KEY_FILE=$(mktemp)
        echo -e "$GPG_PRIVATE_KEY" > "$TEMP_KEY_FILE"
        chmod 600 "$TEMP_KEY_FILE"
        gpg --batch --import "$TEMP_KEY_FILE"
        rm -f "$TEMP_KEY_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        echo "GPG key imported successfully!"
        
        # Get the key ID
        KEY_ID=$(gpg --list-secret-keys --keyid-format=long "$GIT_EMAIL" | grep 'sec' | cut -d'/' -f2 | cut -d' ' -f1)
        
        if [ -n "$KEY_ID" ]; then
            # Configure Git to use the imported key
            git config --global user.signingkey "$KEY_ID"
            git config --global commit.gpgsign true
            git config --global gpg.program gpg
            
            echo "Git configured to use GPG key: $KEY_ID"
            
            # Set ultimate trust for the imported key (since it's our own key)
            if [ -n "$GPG_PRIVATE_KEY_PASSPHRASE" ]; then
                echo -e "5\ny\n" | gpg --batch --command-fd 0 --expert --pinentry-mode loopback --passphrase "$GPG_PRIVATE_KEY_PASSPHRASE" --edit-key "$KEY_ID" trust quit 2>/dev/null
            else
                echo -e "5\ny\n" | gpg --batch --command-fd 0 --expert --edit-key "$KEY_ID" trust quit 2>/dev/null
            fi
            
            # Configure GPG for non-interactive use
            echo "Configuring GPG for non-interactive signing..."
            mkdir -p ~/.gnupg
            chmod 700 ~/.gnupg
            
            # Configure gpg.conf for loopback pinentry
            cat > ~/.gnupg/gpg.conf << EOF
use-agent
pinentry-mode loopback
EOF
            
            # Configure gpg-agent for passphrase caching
            cat > ~/.gnupg/gpg-agent.conf << EOF
default-cache-ttl 28800
max-cache-ttl 28800
allow-loopback-pinentry
EOF
            # Restart GPG agent
            gpg-connect-agent reloadagent /bye 2>/dev/null || true
            
            echo "GPG key setup complete!"
        else
            echo "Warning: Could not find key ID for $GIT_EMAIL"
        fi
    else
        echo "Error: Failed to import GPG key"
    fi
else
    echo "GPG_PRIVATE_KEY environment variable not set."
    echo "To generate a new GPG key for commit signing, run:"
    echo "gpg --batch --full-generate-key <<EOF"
    echo "%echo Generating GPG key for $GIT_USER"
    echo "Key-Type: RSA"
    echo "Key-Length: 4096"
    echo "Subkey-Type: RSA"
    echo "Subkey-Length: 4096"
    echo "Name-Real: $GIT_USER"
    echo "Name-Email: $GIT_EMAIL"
    echo "Expire-Date: 2y"
    echo "Passphrase: "
    echo "%commit"
    echo "%echo GPG key generation complete"
    echo "EOF"
    echo ""
    echo "After generating the key, configure Git to use it:"
    echo "git config --global user.signingkey \$(gpg --list-secret-keys --keyid-format=long $GIT_EMAIL | grep 'sec' | cut -d'/' -f2 | cut -d' ' -f1)"
    echo "git config --global commit.gpgsign true"
fi
