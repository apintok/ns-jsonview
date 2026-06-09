import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'NetSuite JSON View',
    description:
      'Detects JSON in NetSuite Text Area fields and displays a formatted tree view.',
    permissions: [],
    host_permissions: ['*://*.netsuite.com/*'],
  },
});
