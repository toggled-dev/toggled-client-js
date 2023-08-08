# Toggled Client for the browser (JS)

The JavaScript client is a tiny Toggled client written in JavaScript without any external dependencies (except from browser APIs). This client stores toggles relevant for the current user in `localStorage` and synchronizes with Toggled (see [Integrate Toggled in your app](https://docs.saas.toggled.dev/docs/getting-started/integrate-toggled) in the background. Because toggles are stored in the user's browser, the client can use them to bootstrap itself the next time the user visits the same web page.

This client expect `fetch` to be available. If you need to support older
browsers you should probably use the [fetch polyfill](https://github.com/github/fetch). 

## Frameworks supported

This package is not tied to any framework, but can be used together most popular frameworks, examples:

- [React](https://reactjs.org/)
- [React Native](https://reactnative.dev/) 
- [Angular JS](https://angularjs.org/)
- [Vue.js](https://vuejs.org/)
- ...and probably your favorite! 

## How to use the client

### Step 1: Installation

```js
npm install @toggled.dev/toggled-client-js
```

### Step 2: Initialize the SDK

---

💡 **TIP**: As a client-side SDK, this SDK requires you to connect to the regional Toggled client endpoint. Refer to the [connection options](#connection-options) for more information.

---

Configure the client according to your needs. The following example provides only the required options. Refer to [the section on available options](#available-options) for the full list.

```js
import { ToggledClient, TOGGLED_PLATFORM_URLS } from '@toggled.dev/toggled-client-js';

const toggled = new ToggledClient({
    url: TOGGLED_PLATFORM_URLS.EUC1,
    clientKey: '<your-client-api-key>',
});

// Start the background polling
toggled.start();
```

#### Connection options

To connect this SDK to your Toggled workspace, configure the `url` parameter selecting the Toggled region where your account has been created.

Possible options are listed below:

| option            | description                      |
|-------------------|----------------------------------|
| TOGGLED_PLATFORM_URLS.USE1 | us-east-1 AWS region |
| TOGGLED_PLATFORM_URLS.EUC1 | eu-central-1 AWS region |
| TOGGLED_PLATFORM_URLS.APS1 | ap-south-1 AWS region |

### Step 3: Let the client synchronize

You should wait for the client's `ready` or `initialized` events before you start working with it. Before it's ready, the client might not report the correct state for your features.

```js
toggled.on('ready', () => {
    if (toggled.isEnabled('feature.1')) {
        console.log('feature.1 is enabled');
    } else {
        console.log('feature.1 is disabled');
    }
});
```

The difference between the events is described in the [section on available events](#available-events).

### Step 4: Check feature toggle states

Once the client is ready, you can start checking features in your application. Use the `isEnabled` method to check the state of any feature you want:

```js
toggled.isEnabled('feature.1');
```

You can use the `getValue` method to get the value of the feature. 

```js
const featureValue = toggled.getValue('string.feature.2');
if (featureValue === 'blue') {
    // something with variant blue...
}
```

#### Updating the context

The [Context parameters](https://docs.saas.toggled.dev/docs/getting-started/examples#context-parameters) are simple key-value pairs provided by the client as additional information. Parameters are used in strategies and to identify a specific user session. To update and configure the context parameters in this SDK, use the `updateContext` and `setContextParameter` methods.

The context you set in your app will be passed along to the Toggled client endpoint as query parameters for feature evaluation.

The `updateContext` method will replace the entire context with the data that you pass in.

The `setContextParameter` method only acts on the parameter that you choose. It does not affect any other parameters of the context.

```js
toggled.updateContext({ userId: '1233' });

toggled.setContextParameter('userId', '4141');
```

### Available options

The Toggled SDK takes the following options:

| option            | required | default | description                                                                                                                                      |
|-------------------|----------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| url               | yes | n/a | The Toggled URL to connect to. E.g.: `TOGGLED_PLATFORM_URLS.EUC1`                                                                         |
| clientKey         | yes | n/a | The client key to be used                                                                                                             | 
| refreshInterval   | no | `30` | How often, in seconds, the SDK should check for updated toggle configuration. If set to 0 will disable checking for updates                 |
| disableRefresh    | no | `false` | If set to true, the client will not check for updated toggle configuration                                                                |
| metricsInterval   | no | `60` | How often, in seconds, the SDK should send usage metrics back to Toggled                                                           | 
| disableMetrics    | no | `true` | Set this option to `fasle` if you want to send usage metrics - Currently not supported                                           |
| storageProvider   | no | `LocalStorageProvider` in browser, `InMemoryStorageProvider` otherwise | Allows you to inject a custom storeProvider                                                                              |
| fetch             | no | `window.fetch` or global `fetch` | Allows you to override the fetch implementation to use. Useful in Node.js environments where you can inject `node-fetch`                    | 
| bootstrap         | no | `[]` | Allows you to bootstrap the cached feature toggle configuration.                                                                               | 
| bootstrapOverride | no| `true` | Should the bootstrap automatically override cached data in the local-storage. Will only be used if bootstrap is not an empty array.     | 
| customHeaders     | no| `{}` | Additional headers to use when making HTTP requests to the Toggled client endpoint. In case of name collisions with the default headers, the `customHeaders` value will be used if it is not `null` or `undefined`. `customHeaders` values that are `null` or `undefined` will be ignored. |
| impressionDataAll | no| `false` | Allows you to trigger "impression" events for **all** `getToggle` and `getValue` invocations. This is particularly useful for "disabled" feature toggles that are not visible to frontend SDKs. |

### Listen for updates via the EventEmitter

The client is also an event emitter. This means that your code can subscribe to updates from the client. 
This is a neat way to update a single page app when toggle state updates. 

```js
toggled.on('update', () => {
    const myToggle = toggled.isEnabled('feature.1');
    //do something useful
});
```

#### Available events:

- **error** - emitted when an error occurs on init, or when fetch function fails, or when fetch receives a non-ok response object. The error object is sent as payload.
- **initialized** - emitted after the SDK has read local cached data in the storageProvider. 
- **ready** - emitted after the SDK has successfully started and performed the initial fetch towards the Toggled client endpoint. 
- **update** - emitted every time a new feature toggle configuration is returned. The SDK will emit this event as part of the initial fetch from the SDK.  

> PS! Please remember that you should always register your event listeners before your call `toggled.start()`. If you register them after you have started the SDK you risk loosing important events. 

### Session ID

The SDK automatically stores the session identifier generated by Toggled client endpoint and use it in the following HTTP requests.   

### Stop the SDK
You can stop the Toggled client by calling the `stop` method. Once the client has been stopped, it will no longer check for updates or send metrics to the server.

A stopped client _can_ be restarted.

```js
toggled.stop()
```

### Custom store

This SDK can work with React Native storage [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/) or [react-native-shared-preferences](https://github.com/sriraman/react-native-shared-preferences) and many more to backup feature toggles locally. This is useful for bootstrapping the SDK the next time the user comes back to your application. 

You can provide your own storage implementation. 

Examples: 

```typescript
import SharedPreferences from 'react-native-shared-preferences';
import { ToggledClient } from '@toggled.dev/toggled-client-js';

const toggled = new ToggledClient({
    url: TOGGLED_PLATFORM_URLS.EUC1,
    clientKey: 'your-client-key',
    storageProvider: {
      save: (name: string, data: any) => SharedPreferences.setItem(name, data),
      get: (name: string) => SharedPreferences.getItem(name, (val) => val)
    },
});
```

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToggledClient } from '@toggled.dev/toggled-client-js';

const PREFIX = 'toggled:repository';

const toggled = new ToggledClient({
    url: TOGGLED_PLATFORM_URLS.EUC1,
    clientKey: 'your-client-key',
    storageProvider: {
       save: (name: string, data: any) => {
        const repo = JSON.stringify(data);
        const key = `${PREFIX}:${name}`;
        return AsyncStorage.setItem(key, repo);
      },
      get: (name: string) => {
        const key = `${PREFIX}:${name}`;
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : undefined;
      }
    },
});
```
## How to use in node.js

This SDK can also be used in node.js applications (from v1.4.0). Please note that you will need to provide a valid "fetch" implementation. Only ECMAScript modules is exported from this package.

```js
import fetch from 'node-fetch';
import { ToggledClient, InMemoryStorageProvider } from '@toggled.dev/toggled-client-js';

const toggled = new ToggledClient({
  url: TOGGLED_PLATFORM_URLS.EUC1,
  clientKey: 'client-123',
  storageProvider: new InMemoryStorageProvider(),
  fetch,
});

await toggled.start();
const isEnabled = toggled.isEnabled('feature.1');
console.log(isEnabled);
```
*index.mjs*

## Bootstrap
Now it is possible to bootstrap the SDK with your own feature toggle configuration when you don't want to make an API call.  

This is also useful if you require the toggles to be in a certain state immediately after initializing the SDK.

### How to use it ?
Add a `bootstrap` attribute when create a new `ToggledClient`.  
There's also a `bootstrapOverride` attribute which is by default is `true`.

```js
import { ToggledClient } from '@toggled.dev/toggled-client-js';

const toggled = new ToggledClient({
  url: TOGGLED_PLATFORM_URLS.EUC1,
  clientKey: 'client-123',
  bootstrap: [{
	"toggleStatus": "on",
	"toggleName": "demoApp.step4",
    "toggleValue": true,
    "toggleValueType": 'boolean'
  }],
  bootstrapOverride: false
});
```
**NOTES: ⚠️**
If `bootstrapOverride` is `true` (by default), any local cached data will be overridden with the bootstrap specified.   
If `bootstrapOverride` is `false` any local cached data will not be overridden unless the local cache is empty.
