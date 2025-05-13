# basset-hound-browser
a web browser to automatically load useful extensions

> https://nodejs.org/en/download

```bash
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"

# Download and install Node.js:
nvm install 22

# Verify the Node.js version:
node -v # Should print "v22.15.0".
nvm current # Should print "v22.15.0".

# Verify npm version:
npm -v # Should print "10.9.2".
```

**Using Node.js 22**

Install dependencies:

```bash
npm install
```

Run the app:

```bash
DEBUG=electron* npm start
```

## See project structure

```bash
tree -I 'node_modules|package-lock.json|venv'
```