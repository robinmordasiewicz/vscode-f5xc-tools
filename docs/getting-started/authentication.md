# Authentication

F5 Distributed Cloud Tools supports two authentication methods for connecting to
your F5 XC tenant: API Token and P12 Certificate. Both methods provide secure
authentication with credentials stored in VS Code's SecretStorage.

## Authentication Methods

| Method              | Use Case                         | Security Level | Recommended For                                         |
| ------------------- | -------------------------------- | -------------- | ------------------------------------------------------- |
| **API Token**       | Quick setup, API automation      | High           | Development, testing, CI/CD                             |
| **P12 Certificate** | Mutual TLS (mTLS) authentication | Very High      | Production, compliance, security-sensitive environments |

## API Token Authentication

API Token authentication uses a bearer token to authenticate requests to the F5
XC API.

### Obtaining an API Token

1. Log in to the F5 Distributed Cloud Console
2. Navigate to **Administration** → **Personal Management** → **Credentials**
3. Click **Add Credentials**
4. Select **API Token** as the credential type
5. Enter a name for the token (e.g., "VS Code Extension")
6. Set an expiration date (recommended: 90 days or less)
7. Click **Generate**
8. **Important**: Copy the token immediately - it won't be shown again

!!! warning "Token Security" - Never commit API tokens to source control - Store
tokens securely in VS Code SecretStorage (handled automatically) - Use short
expiration periods and rotate tokens regularly - Revoke tokens immediately if
compromised

### Configuring API Token in VS Code

1. Open the F5 XC sidebar in VS Code
2. In the **Profiles** section, click the **`+`** button
3. Enter profile details:

| Field                   | Value               | Example                                  |
| ----------------------- | ------------------- | ---------------------------------------- |
| **Profile Name**        | Friendly identifier | `my-tenant-dev`                          |
| **API URL**             | F5 XC console URL   | `https://tenant.console.ves.volterra.io` |
| **Authentication Type** | Select `API Token`  | API Token                                |

4. When prompted, paste your API token
5. Click **Save**

### API Token Validation

The extension validates your token by making a test request to:

```http
GET https://tenant.console.ves.volterra.io/api/web/namespaces
```

**Valid Response**: HTTP 200 - Token is valid **Invalid Response**: HTTP
401/403 - Token is invalid or expired

## P12 Certificate Authentication

P12 (PKCS#12) certificate authentication provides mutual TLS (mTLS) security
using client certificates.

### Obtaining a P12 Certificate

1. Log in to the F5 Distributed Cloud Console
2. Navigate to **Administration** → **Personal Management** → **Credentials**
3. Click **Add Credentials**
4. Select **API Certificate** as the credential type
5. Enter a name for the certificate
6. Set an expiration date (recommended: 365 days or less)
7. Click **Generate**
8. Download the `.p12` file
9. **Important**: Save the password shown - you'll need it for authentication

!!! tip "Certificate Storage" Store your `.p12` file in a secure location:

    - macOS: `~/Library/Application Support/f5xc/`
    - Linux: `~/.config/f5xc/`
    - Windows: `%APPDATA%\f5xc\`

### Configuring P12 Certificate in VS Code

1. Open the F5 XC sidebar in VS Code
2. In the **Profiles** section, click the **`+`** button
3. Enter profile details:

| Field                   | Value                    | Example                                  |
| ----------------------- | ------------------------ | ---------------------------------------- |
| **Profile Name**        | Friendly identifier      | `my-tenant-prod`                         |
| **API URL**             | F5 XC console URL        | `https://tenant.console.ves.volterra.io` |
| **Authentication Type** | Select `P12 Certificate` | P12 Certificate                          |

4. When prompted:
   - **P12 File Path**: Browse to your `.p12` file
   - **Password**: Enter the certificate password
5. Click **Save**

### P12 Certificate Validation

The extension validates your certificate by establishing an mTLS connection:

```http
GET https://tenant.console.ves.volterra.io/api/web/namespaces
```

The certificate and private key are extracted from the P12 bundle using
`node-forge` and used to create a secure HTTPS agent.

**Valid Response**: HTTP 200 - Certificate is valid **Invalid Response**: HTTP
401/403 - Certificate is invalid or expired

## Alternative: Separate Certificate and Key Files

For advanced use cases, you can use separate PEM files instead of a P12 bundle:

1. Extract certificate from P12:

```bash
openssl pkcs12 -in certificate.p12 -clcerts -nokeys -out cert.pem
```

2. Extract private key from P12:

```bash
openssl pkcs12 -in certificate.p12 -nocerts -nodes -out key.pem
```

3. Configure in VS Code:
   - **Certificate Path**: Path to `cert.pem`
   - **Private Key Path**: Path to `key.pem`

!!! note "No Password Required" When using separate PEM files, no password is
needed (the key is already decrypted).

## Environment Variables

### P12 Password

Instead of entering the password interactively, you can set the
`F5XC_P12_PASSWORD` environment variable:

**macOS/Linux:**

```bash
export F5XC_P12_PASSWORD="your-p12-password"
```

**Windows:**

```powershell
$env:F5XC_P12_PASSWORD = "your-p12-password"
```

Add to your shell profile (`.bashrc`, `.zshrc`, etc.) for persistence.

## Credential Storage

All credentials are stored securely in VS Code's SecretStorage:

- **API Tokens**: Encrypted at rest by the operating system's credential manager
- **P12 Passwords**: Encrypted at rest, never logged
- **Certificate Paths**: Stored in extension settings (paths only, not contents)

**Credential Managers by Platform:**

- macOS: Keychain
- Linux: Secret Service API (GNOME Keyring, KWallet)
- Windows: Credential Manager

## Security Best Practices

### Token Security

- ✅ Use short expiration periods (30-90 days)
- ✅ Rotate tokens regularly
- ✅ Revoke tokens when no longer needed
- ✅ Use separate tokens for different purposes (dev, CI/CD, production)
- ❌ Never commit tokens to source control
- ❌ Never share tokens between users

### Certificate Security

- ✅ Protect P12 files with strong passwords
- ✅ Store certificates in secure directories with restricted permissions
- ✅ Use short expiration periods (90-365 days)
- ✅ Revoke certificates when no longer needed
- ❌ Never commit P12 files to source control
- ❌ Never share certificates between users

### Permission Model

Both authentication methods provide the same API permissions as your F5 XC user
account. Follow the principle of least privilege:

- Use dedicated service accounts for automation
- Assign minimal required roles (viewer, editor, admin)
- Review and audit credential usage regularly

## Common Authentication Issues

### API Token

**Error: "API token validation failed: 401"**

- **Cause**: Token is invalid, expired, or revoked
- **Solution**: Generate a new API token and update the profile

**Error: "API token cannot be empty"**

- **Cause**: Token not provided or contains only whitespace
- **Solution**: Ensure you paste the complete token without extra spaces

### P12 Certificate

**Error: "Invalid P12 password"**

- **Cause**: Incorrect password or password contains special characters
- **Solution**: Verify password, set `F5XC_P12_PASSWORD` environment variable

**Error: "P12 file not found"**

- **Cause**: Incorrect file path or file moved/deleted
- **Solution**: Browse to the correct P12 file location

**Error: "No certificate found in P12 file"**

- **Cause**: P12 file is corrupted or invalid
- **Solution**: Re-download the P12 file from F5 XC console

**Error: "Certificate validation failed: 403"**

- **Cause**: Certificate is valid but lacks required permissions
- **Solution**: Verify your F5 XC user account has appropriate roles

### Network Issues

**Error: "Token/Certificate validation request timed out"**

- **Cause**: Network connectivity issues or firewall blocking HTTPS
- **Solution**:
  - Verify internet connectivity
  - Check firewall/proxy settings
  - Ensure F5 XC API URL is accessible

**Error: "Certificate validation request failed"**

- **Cause**: DNS resolution failure or network error
- **Solution**:
  - Verify API URL is correct (e.g., `https://tenant.console.ves.volterra.io`)
  - Test connectivity:
    `curl https://tenant.console.ves.volterra.io/api/web/namespaces`

## API URL Formats

Your API URL depends on your F5 XC environment:

| Environment    | API URL Format                           | Example                                |
| -------------- | ---------------------------------------- | -------------------------------------- |
| **Production** | `https://TENANT.console.ves.volterra.io` | `https://acme.console.ves.volterra.io` |
| **Staging**    | `https://TENANT.staging.volterra.us`     | `https://acme.staging.volterra.us`     |

!!! tip "Finding Your API URL" Your API URL is the same URL you use to access
the F5 Distributed Cloud Console in your browser.

## Testing Authentication

After configuring a profile, test authentication:

1. Set the profile as active (right-click → **Set as Active**)
2. Check the **Resources** tree view
3. If namespaces appear, authentication is successful
4. If authentication fails, check the **Output** panel:
   - View → Output
   - Select "F5 XC Tools" from the dropdown
   - Review error messages for troubleshooting

## Switching Between Profiles

To switch between different tenants or authentication methods:

1. Right-click any profile in the **Profiles** view
2. Select **Set as Active**
3. The Resources tree will refresh with the new profile's credentials

Only one profile can be active at a time. The active profile is indicated by a
checkmark (✓).

## Next Steps

- [Browse and manage resources](../user-guide/explorer.md)
- [Perform CRUD operations](../user-guide/crud-operations.md)
- [Learn about supported resource types](../features/resource-types.md)
