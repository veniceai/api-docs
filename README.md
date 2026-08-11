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
- Update `docs.json` to configure site navigation and metadata
- Place images and assets in the corresponding directories
- Reference the OpenAPI specification in `swagger.yaml` for API details

**Translations:** Edit English source pages only. Mintlify regenerates locale copies after merge to `main`. Do not hand-edit every locale in the same PR unless you are intentionally updating all translations. When adding a new nav page, add the English path in `docs.json` only — not `{locale}/...` paths until translations exist.

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