# Quick Start

Get started with F5 Distributed Cloud Tools in just a few minutes.

## Step 1: Add a Profile

After [installing the extension](installation.md), create your first profile:

1. Open the F5 XC sidebar by clicking the F5 icon in the Activity Bar
2. In the **Profiles** section, click the **`+`** button
3. Enter your profile information:

| Field                   | Description                             | Example                                  |
| ----------------------- | --------------------------------------- | ---------------------------------------- |
| **Profile Name**        | A friendly name for this connection     | `my-tenant`                              |
| **API URL**             | Your F5 XC console URL                  | `https://tenant.console.ves.volterra.io` |
| **Authentication Type** | Choose `API Token` or `P12 Certificate` | `API Token`                              |

4. Enter your credentials when prompted:
   - **API Token**: Paste your token from the F5 XC console
   - **P12 Certificate**: Select the `.p12` file and enter the password

5. Click **Save** to store the profile

!!! tip "Finding Your API URL" Your API URL is the console URL you use to access
F5 Distributed Cloud. Common formats:

    - `https://TENANT.console.ves.volterra.io`
    - `https://TENANT.staging.volterra.us`

## Step 2: Set Active Profile

If you have multiple profiles:

1. In the **Profiles** view, find your profile
2. Right-click the profile
3. Select **Set as Active**

The active profile is used for all resource operations.

## Step 3: Browse Resources

Once a profile is active, explore your F5 XC resources:

1. The **Resources** tree view will populate with namespaces
2. Expand a namespace (e.g., `default`) to see resource categories
3. Expand a category (e.g., `Load Balancing`) to see resource types
4. Expand a resource type (e.g., `HTTP Load Balancers`) to see individual
   resources
5. Click any resource to view its configuration

### Resource Tree Hierarchy

```text
Resources
├── 📁 Namespace: default
│   ├── 📂 Load Balancing
│   │   ├── 📄 HTTP Load Balancers
│   │   │   ├── my-app-lb
│   │   │   └── api-gateway-lb
│   │   ├── 📄 Origin Pools
│   │   └── 📄 Health Checks
│   ├── 📂 Security
│   │   ├── 📄 App Firewalls
│   │   └── 📄 Service Policies
│   └── 📂 Networking
│       ├── 📄 Virtual Networks
│       └── 📄 Network Connectors
└── 📁 Namespace: production
    └── ...
```

## Step 4: View a Resource

To view a resource configuration:

1. Navigate to the resource in the tree
2. Click the resource name
3. The configuration opens in a JSON editor
4. Review the resource spec, metadata, and status

## Step 5: Edit a Resource

To modify a resource:

1. Right-click the resource in the tree
2. Select **Edit Resource**
3. Modify the JSON configuration
4. Save the file (`Ctrl+S` / `Cmd+S`)
5. The changes are automatically applied to F5 XC

!!! warning "Validation" The extension validates your changes against the
resource schema before applying. Invalid configurations will show errors in the
editor.

## Common Tasks

### Create a New Resource

1. Right-click a resource type (e.g., `HTTP Load Balancers`)
2. Select **Create Resource**
3. Enter a resource name
4. Edit the generated template
5. Save to create the resource

### Delete a Resource

1. Right-click the resource
2. Select **Delete Resource**
3. Confirm the deletion
4. The resource is removed from F5 XC

### Compare with Remote

To see differences between your local edits and the remote version:

1. Right-click the resource
2. Select **Compare with Remote**
3. Review the diff view showing changes

### Refresh Resources

To refresh the resource tree:

- Click the refresh icon in the Resources view title bar
- Or use keyboard shortcut: `Ctrl+Shift+R` / `Cmd+Shift+R`

## Keyboard Shortcuts

| Action              | Windows/Linux  | macOS         |
| ------------------- | -------------- | ------------- |
| Apply Configuration | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Refresh Explorer    | `Ctrl+Shift+R` | `Cmd+Shift+R` |

## Next Steps

- Learn about [authentication methods](authentication.md)
- Explore [profile management](../user-guide/profiles.md)
- View all [supported resource types](../features/resource-types.md)
- Check [CRUD operations guide](../user-guide/crud-operations.md)

## Troubleshooting

### Resources Not Loading

If resources don't appear:

1. Verify your profile is set as active (green checkmark)
2. Check your credentials are valid
3. Ensure you have network access to the F5 XC API
4. Review the Output panel for error messages

### Authentication Fails

If authentication fails:

1. Verify your API URL is correct
2. Check your API token hasn't expired
3. For P12: Ensure the certificate is valid and password is correct
4. Check firewall/proxy settings

### Changes Not Applying

If edits don't save:

1. Check for validation errors in the editor
2. Ensure you have write permissions in F5 XC
3. Verify the resource isn't locked by another process
4. Review the Output panel for API errors
