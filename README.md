# venice API Documentation

This repo holds the documentation for the Venice API. The doc-site itself is built using [Mintlify](https://mintlify.com), providing a clean, modern interface for exploring our API capabilities.

## 📚 Documentation Structure

Our documentation is organized into several key sections:

- **Welcome** - Introduction to venice and getting started guides
- **API Reference** - Detailed API endpoint documentation
- **Guides** - Step-by-step tutorials and integration examples
- **Changelog** - Latest updates and API changes

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your system

### Local Development

> !! Make sure you're on the node version specified in the `.nvmrc` file.

1. Clone this repository and navigate to the project directory:
```bash
git clone git@github.com:veniceai/api-docs.git
cd api-docs
```

2. Install dependencies:
```bash
yarn
```

3. Start the development server:
```bash
yarn dev
```

The documentation will be available at `http://localhost:3000`.

### Making Changes

- Edit `.mdx` files to modify the documentation content
- Update `mint.json` to configure site navigation and metadata
- Place images and assets in the corresponding directories
- Reference the OpenAPI specification in `swagger.yaml` for API details

### Copy Markdown Button

Use the shared snippet when you want a page-level control that copies the current page's Mintlify Markdown export:

```mdx
import { CopyMarkdownButton } from "/snippets/CopyMarkdownButton.jsx";

<CopyMarkdownButton />
```

By default, the button fetches the current page URL with a `.md` extension. If a page needs to copy a different Markdown export, pass `sourcePath`:

```mdx
<CopyMarkdownButton sourcePath="/guides/overview.md" label="Copy guide Markdown" />
```

Mintlify's local preview does not serve `.md` exports, and browsers cannot copy from the deployed docs during local testing unless the deployed site allows cross-origin reads. In local preview, the button displays `Unavailable locally`; test the full copy flow on deployed docs.

## 📖 Documentation Features

- 🎨 Clean, modern UI with customizable theming
- 📱 Responsive design for all devices
- 🔍 Full-text search capabilities
- 🚦 Interactive API request builder
- 📊 OpenAPI specification integration - Swagger
- 🌙 Dark/light mode support

## 🔄 Deployment

Changes are automatically deployed when pushed to the main branch. Just:

1. Push changes to your default branch
3. Your documentation will automatically update at your deployment URL

NOTE that this repo does not have preview branches at the moment. So you'll need to test your changes locally before submitting a PR. The person reviewing the PR will have to pull the branch and test it locally.

## 🛠 Troubleshooting

If you encounter any issues:

- **404 Errors**: Ensure you're running the dev server in a directory containing `mint.json`
- **Development Server Issues**: Run `yarn install` to reinstall dependencies
- **Content Not Updating**: Clear your browser cache or try a hard refresh

## 💡 Contributing

1. Create a new branch for your changes
2. Make your updates to the documentation
3. Test locally using `yarn dev`
4. Submit a pull request with a clear description of your changes

---

Built with [Mintlify](https://mintlify.com)