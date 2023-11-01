import { FetchMock } from 'jest-fetch-mock';
import 'jest-localstorage-mock';
import * as data from './test/testdata.json';
import IStorageProvider from './storage-provider';
import {
    EVENTS,
    TOGGLED_PLATFORM_URLS,
    IConfig,
    IContext,
    ToggledClient,
    IToggle,
    TOGGLES_STATUS,
    TOGGLES_VALUE_TYPES,
} from './index';
import { getTypeSafeRequest, getTypeSafeRequestUrl } from './test';

jest.useFakeTimers();

const fetchMock = fetch as FetchMock;

afterEach(() => {
    fetchMock.resetMocks();
    jest.clearAllTimers();
});

test('Should initialize toggled-client', () => {
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    new ToggledClient(config);
    expect(config.url).toBe('http://localhost/test');
});

test('Should perform an initial fetch', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.start();
    const isEnabled = client.isEnabled('simpleToggle');
    client.stop();
    expect(isEnabled).toBe(true);
});

// POST requests are not currently supported

// test('Should perform an initial fetch as POST', async () => {
//     fetchMock.mockResponseOnce(JSON.stringify(data));
//     const config: IConfig = {
//         url: TOGGLED_PLATFORM_URLS.TEST,
//         clientKey: '12',
//         appName: 'webAsPOST',
//         usePOSTrequests: true,
//     };
//     const client = new ToggledClient(config);
//     await client.start();

//     const request = getTypeSafeRequest(fetchMock, 0);
//     const body = JSON.parse(request.body as string);

//     expect(request.method).toBe('POST');
//     expect(body.context.appName).toBe('webAsPOST');
// });

test('Should perform an initial fetch as GET', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.start();

    const request = getTypeSafeRequest(fetchMock, 0);

    expect(request.method).toBe('GET');
});

test('Should have correct value', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.start();
    const value = client.getValue('stringToggle');
    client.stop();
    expect(value).toBe('some-text');
});

test('Should return undefined if not found', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.start();
    const value = client.getValue('missingToggle');
    client.stop();
    expect(value).toBe(undefined);
});

test('Should handle error and return false for isEnabled', async () => {
    jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
    fetchMock.mockReject();

    class Store implements IStorageProvider {
        public async save() {
            return Promise.resolve();
        }

        public async get() {
            return Promise.resolve([]);
        }
    }

    const storageProvider = new Store();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        storageProvider,
    };
    const client = new ToggledClient(config);
    await client.start();
    const isEnabled = client.isEnabled('simpleToggle');
    client.stop();
    expect(isEnabled).toBe(false);
});

test('Should read session id from localStorage', async () => {
    const sessionId = '123';
    fetchMock.mockReject();

    class Store implements IStorageProvider {
        public async save() {
            return Promise.resolve();
        }

        public async get(name: string) {
            if (name === 'sessionId') {
                return sessionId;
            } else {
                return Promise.resolve([]);
            }
        }
    }

    const storageProvider = new Store();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        storageProvider,
    };
    const client = new ToggledClient(config);
    await client.start();
    const currentSessionId = client.getCurrentSessionId();
    expect(currentSessionId).toBe(sessionId);
});

test('Should read toggles from localStorage', async () => {
    jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
    const toggles = [
        {
            toggleName: 'featureToggleBackup',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];
    fetchMock.mockReject();

    class Store implements IStorageProvider {
        public async save() {
            return Promise.resolve();
        }

        public async get(name: string) {
            if (name === 'repo') {
                return Promise.resolve(toggles);
            } else {
                return Promise.resolve(undefined);
            }
        }
    }

    const storageProvider = new Store();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        storageProvider,
    };
    const client = new ToggledClient(config);
    await client.start();
    expect(client.isEnabled('featureToggleBackup')).toBe(true);
    expect(client.isEnabled('featureUnknown')).toBe(false);
});

test('Should bootstrap data when bootstrap is provided', async () => {
    localStorage.clear();
    const storeKey = 'toggled:repository:repo';
    const bootstrap: IToggle[] = [
        {
            toggleName: 'toggles',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'algo',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];
    const initialData = [
        {
            toggleName: 'initialData',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'test initial',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    localStorage.setItem(storeKey, JSON.stringify(initialData));
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
    };
    const client = new ToggledClient(config);
    await client.start();

    expect(client.getAllToggles()).toStrictEqual(bootstrap);
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(bootstrap));
});

test('Should set internal toggle state when bootstrap is set, before client is started', async () => {
    localStorage.clear();
    const storeKey = 'toggled:repository:repo';
    const bootstrap: IToggle[] = [
        {
            toggleName: 'toggles',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'algo',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];
    const initialData = [
        {
            toggleName: 'initialData',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'test initial',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    localStorage.setItem(storeKey, JSON.stringify(initialData));
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
    };
    const client = new ToggledClient(config);
    expect(client.getAllToggles()).toStrictEqual(bootstrap);
    await client.start();
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(bootstrap));
});

test('Should not bootstrap data when bootstrapOverride is false and localStorage is not empty', async () => {
    localStorage.clear();
    const storeKey = 'toggled:repository:repo';
    const bootstrap: IToggle[] = [
        {
            toggleName: 'toggles',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'algo',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];
    const initialData = [
        {
            toggleName: 'initialData',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'test initial',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    localStorage.setItem(storeKey, JSON.stringify(initialData));
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
        bootstrapOverride: false,
    };
    const client = new ToggledClient(config);
    await client.start();

    expect(client.getAllToggles()).toStrictEqual(initialData);
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));
});

test('Should bootstrap when bootstrapOverride is false and local storage is empty', async () => {
    localStorage.clear();
    const storeKey = 'toggled:repository:repo';
    const bootstrap: IToggle[] = [
        {
            toggleName: 'toggles',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'algo',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    localStorage.setItem(storeKey, JSON.stringify([]));
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify([]));

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
        bootstrapOverride: false,
    };
    const client = new ToggledClient(config);
    await client.start();

    expect(client.getAllToggles()).toStrictEqual(bootstrap);
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(bootstrap));
});

test('Should not bootstrap data when bootstrap is []', async () => {
    localStorage.clear();
    const storeKey = 'toggled:repository:repo';
    const initialData = [
        {
            toggleName: 'initialData',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'test initial',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    localStorage.setItem(storeKey, JSON.stringify(initialData));
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap: [],
        bootstrapOverride: true,
    };
    const client = new ToggledClient(config);
    await client.start();

    expect(client.getAllToggles()).toStrictEqual(initialData);
    expect(localStorage.getItem(storeKey)).toBe(JSON.stringify(initialData));
});

test('Should publish ready event when bootstrap is provided, before client is started', async () => {
    localStorage.clear();
    const bootstrap: IToggle[] = [
        {
            toggleName: 'toggles',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
        {
            toggleName: 'algo',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
    };
    const client = new ToggledClient(config);
    expect(client.getAllToggles()).toStrictEqual(bootstrap);
    client.on(EVENTS.READY, () => {
        expect(client.isEnabled('algo')).toBe(true);
    });
});

test('Should publish ready when initial fetch completed', (done) => {
    fetchMock.mockResponseOnce(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.start();
    client.on(EVENTS.READY, () => {
        const isEnabled = client.isEnabled('simpleToggle');
        client.stop();
        expect(isEnabled).toBe(true);
        done();
    });
});

test('Should publish error when initial init fails', (done) => {
    const givenError = 'Error';

    class Store implements IStorageProvider {
        public async save(): Promise<void> {
            return Promise.reject(givenError);
        }

        public async get(): Promise<any> {
            return Promise.reject(givenError);
        }
    }

    jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
    fetchMock.mockResponseOnce(JSON.stringify(data));

    const storageProvider = new Store();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        storageProvider,
    };
    const client = new ToggledClient(config);
    client.start();
    client.on(EVENTS.ERROR, (e: any) => {
        expect(e).toBe(givenError);
        done();
    });
});

test('Should publish error when fetch fails', (done) => {
    const givenError = new Error('Error');

    jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
    fetchMock.mockReject(givenError);

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.start();
    client.on(EVENTS.ERROR, (e: any) => {
        expect(e).toBe(givenError);
        done();
    });
});

test.each([400, 401, 403, 404, 429, 500, 502, 503])(
    'Should publish error when fetch receives a %d error',
    async (errorCode) => {
        expect.assertions(1);
        jest.spyOn(global.console, 'error').mockImplementation(() => jest.fn());
        fetchMock.mockResponseOnce('{}', { status: errorCode });

        const config: IConfig = {
            url: TOGGLED_PLATFORM_URLS.TEST,
            clientKey: '12',
        };
        const client = new ToggledClient(config);
        client.on(EVENTS.ERROR, (e: any) => {
            expect(e).toStrictEqual({ type: 'HttpError', code: errorCode });
        });
        await client.start();
    }
);

test('Should publish update when state changes after refreshInterval', async () => {
    expect.assertions(1);
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 1,
    };
    const client = new ToggledClient(config);

    let counts = 0;
    client.on(EVENTS.UPDATE, () => {
        counts++;
        if (counts === 2) {
            expect(fetchMock.mock.calls.length).toEqual(2);
            client.stop();
        }
    });

    await client.start();

    jest.advanceTimersByTime(1001);
});

test(`If refresh is disabled should not fetch`, async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        disableRefresh: true,
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 1,
    };
    const client = new ToggledClient(config);
    await client.start();
    jest.advanceTimersByTime(100000);
    expect(fetchMock.mock.calls.length).toEqual(1); // Never called again
});

test('Should include etag in second request', async () => {
    const etag = '123a';
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200, headers: { ETag: etag } }],
        [JSON.stringify(data), { status: 304, headers: { ETag: etag } }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 1,
    };
    const client = new ToggledClient(config);

    await client.start();

    jest.advanceTimersByTime(1001);

    const firstRequest = getTypeSafeRequest(fetchMock, 0);
    const secondRequest = getTypeSafeRequest(fetchMock, 1);

    expect(firstRequest.headers).toMatchObject({
        'If-None-Match': '',
    });
    expect(secondRequest.headers).toMatchObject({
        'If-None-Match': etag,
    });
});

test('Should add clientKey as Authorization header', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: 'some123key',
    };
    const client = new ToggledClient(config);
    await client.start();

    jest.advanceTimersByTime(1001);

    const request = getTypeSafeRequest(fetchMock);

    expect(request.headers).toMatchObject({
        'x-api-key': 'some123key',
    });
});

test('Should require url', () => {
    expect(() => {
        new ToggledClient({ url: '', clientKey: '12' });
    }).toThrow();
});

test('Should require valid url', () => {
    expect(() => {
        new ToggledClient({
            url: 'not-a-url',
            clientKey: '12',
        });
    }).toThrow();
});

test('Should require valid clientKey', () => {
    expect(() => {
        new ToggledClient({
            url: TOGGLED_PLATFORM_URLS.TEST,
            clientKey: '',
        });
    }).toThrow();
});

test('Should stop fetching when stop is called', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 1,
    };
    const client = new ToggledClient(config);

    await client.start();

    jest.advanceTimersByTime(1001);

    client.stop();

    jest.advanceTimersByTime(1001);
    jest.advanceTimersByTime(1001);
    jest.advanceTimersByTime(1001);

    expect(fetchMock.mock.calls.length).toEqual(2);
});

test('Should include context fields on request', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 304 }]
    );
    const context: IContext = {
        userId: '123',
        sessionId: '456',
        remoteAddress: 'address',
        appName: 'web',
        environment: 'prod',
        property1: 'property1',
        property2: 'property2',
    };
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context,
    };
    const client = new ToggledClient(config);

    await client.start();

    jest.advanceTimersByTime(1001);

    const url = new URL(getTypeSafeRequestUrl(fetchMock));

    expect(url.searchParams.get('userId')).toEqual('123');
    expect(url.searchParams.get('sessionId')).toEqual('456');
    expect(url.searchParams.get('remoteAddress')).toEqual('address');
    expect(url.searchParams.get('property1')).toEqual('property1');
    expect(url.searchParams.get('property2')).toEqual('property2');
    expect(url.searchParams.get('appName')).toEqual('web');
    expect(url.searchParams.get('environment')).toEqual('prod');
});

test('Should note include context fields with "null" value', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 304 }]
    );
    const context: IContext = {
        sessionId: '0',
        property1: 'property1',
        property2: 'property2',
    };
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context,
    };
    const client = new ToggledClient(config);

    await client.start();

    jest.advanceTimersByTime(1001);

    const url = new URL(getTypeSafeRequestUrl(fetchMock));

    expect(url.searchParams.has('userId')).toBe(false);
    expect(url.searchParams.has('remoteAddress')).toBe(false);
    expect(url.searchParams.has('sessionId')).toBe(true);
    expect(url.searchParams.get('sessionId')).toBe('0');
});

test('Should update context fields with await', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 304 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.updateContext({
        userId: '123',
        sessionId: '456',
        remoteAddress: 'address',
        appName: 'web',
        environment: 'prod',
        property1: 'property1',
        property2: 'property2',
    });

    await client.start();

    jest.advanceTimersByTime(1001);

    const url = new URL(getTypeSafeRequestUrl(fetchMock));

    expect(url.searchParams.get('userId')).toEqual('123');
    expect(url.searchParams.get('sessionId')).toEqual('456');
    expect(url.searchParams.get('remoteAddress')).toEqual('address');
    expect(url.searchParams.get('property1')).toEqual('property1');
    expect(url.searchParams.get('property2')).toEqual('property2');
    expect(url.searchParams.get('appName')).toEqual('web');
    expect(url.searchParams.get('environment')).toEqual('prod');
});

test('Should update context fields on request', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 304 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.updateContext({
        userId: '123',
        sessionId: '456',
        remoteAddress: 'address',
        appName: 'web',
        environment: 'prod',
        property1: 'property1',
        property2: 'property2',
    });

    await client.start();

    jest.advanceTimersByTime(1001);

    const url = new URL(getTypeSafeRequestUrl(fetchMock));

    expect(url.searchParams.get('userId')).toEqual('123');
    expect(url.searchParams.get('sessionId')).toEqual('456');
    expect(url.searchParams.get('remoteAddress')).toEqual('address');
    expect(url.searchParams.get('property1')).toEqual('property1');
    expect(url.searchParams.get('property2')).toEqual('property2');
    expect(url.searchParams.get('appName')).toEqual('web');
    expect(url.searchParams.get('environment')).toEqual('prod');
});

test('Updating context should wait on asynchronous start', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);

    client.start();
    await client.updateContext({
        userId: '123',
    });

    expect(fetchMock).toBeCalledTimes(2);
});

test('Should not add property fields when properties is an empty object', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 304 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context: {},
    };
    const client = new ToggledClient(config);

    await client.start();

    jest.advanceTimersByTime(1001);

    const url = new URL(getTypeSafeRequestUrl(fetchMock));

    expect(url.searchParams.get('properties')).toBeNull();
});

test('Should setContextParameter with userId', async () => {
    const userId = 'some-id-123';
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.setContextParameter('userId', userId);
    const context = client.getContext();
    expect(context.userId).toBe(userId);
});

test('Should setContextParameter with sessionId', async () => {
    const sessionId = 'some-session-id-123';
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.setContextParameter('sessionId', sessionId);
    const context = client.getContext();
    expect(context.sessionId).toBe(sessionId);
});

test('Should setContextParameter with remoteAddress', async () => {
    const remoteAddress = '10.0.0.1';
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.setContextParameter('remoteAddress', remoteAddress);
    const context = client.getContext();
    expect(context.remoteAddress).toBe(remoteAddress);
});

test('Should setContextParameter with custom property', async () => {
    const clientId = 'some-client-id-443';
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    client.setContextParameter('clientId', clientId);
    const context = client.getContext();
    expect(context.clientId).toBe(clientId);
});

test('Should setContextParameter with custom property and keep existing props', async () => {
    const clientId = 'some-client-id-443';
    const initialContext = { someField: '123' };
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context: initialContext,
    };
    const client = new ToggledClient(config);
    client.setContextParameter('clientId', clientId);
    const context = client.getContext();
    expect(context.clientId).toBe(clientId);
    expect(context.someField).toBe(initialContext.someField);
});

test('Should override userId via setContextParameter', async () => {
    const userId = 'some-user-id-552';
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context: { userId: 'old' },
    };
    const client = new ToggledClient(config);
    client.setContextParameter('userId', userId);
    const context = client.getContext();
    expect(context.userId).toBe(userId);
});

test('Should store new sessionId', async () => {
    fetchMock.mockResponse(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    await client.start();
    const sessionId = client.getCurrentSessionId();
    expect(sessionId).toBe('abcdefghijklmnopqrstvwxyz');
    client.stop();
});

test('Should pass sessionId from localStorage in header', async () => {
    const sessionId = '123';
    fetchMock.mockReject();

    class Store implements IStorageProvider {
        public async save() {
            return Promise.resolve();
        }

        public async get(name: string) {
            if (name === 'sessionId') {
                return sessionId;
            } else {
                return Promise.resolve([]);
            }
        }
    }

    const storageProvider = new Store();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        storageProvider,
    };
    const client = new ToggledClient(config);

    await client.start();
    jest.advanceTimersByTime(1001);

    const featureRequest = getTypeSafeRequest(fetchMock, 0);
    client.stop();

    expect(featureRequest.headers).toMatchObject({
        'session-id': sessionId,
    });
});

test('Initializing client twice should show a console warning', async () => {
    console.error = jest.fn();
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        context: { userId: 'old' },
    };
    const client = new ToggledClient(config);

    await client.start();
    await client.start();
    // Expect console.error to be called once before start runs.
    expect(console.error).toBeCalledTimes(2);
});

// test('Should pass under custom header clientKey', async () => {
//     fetchMock.mockResponseOnce(JSON.stringify(data));

//     const config: IConfig = {
//         url: TOGGLED_PLATFORM_URLS.TEST,
//         clientKey: '12',
//         headerName: 'NotAuthorization',
//     };
//     const client = new ToggledClient(config);

//     client.on(EVENTS.UPDATE, () => {
//         const request = getTypeSafeRequest(fetchMock, 0);

//         expect(fetchMock.mock.calls.length).toEqual(1);
//         expect(request.headers).toMatchObject({
//             NotAuthorization: '12',
//         });
//         client.stop();
//     });

//     await client.start();

//     jest.advanceTimersByTime(999);
// });

test('Should emit impression events on isEnabled calls when impressionData is true', (done) => {
    const bootstrap = [
        {
            toggleName: 'impression',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
            toggleValue: true,
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        impressionDataAll: true,
        bootstrap,
    };
    const client = new ToggledClient(config);
    client.start();

    client.on(EVENTS.READY, () => {
        const isEnabled = client.isEnabled('impression');
        expect(isEnabled).toBe(true);
    });

    client.on(EVENTS.IMPRESSION, (event: any) => {
        expect(event.featureName).toBe('impression');
        expect(event.eventType).toBe('isEnabled');
        client.stop();
        done();
    });
});

test('Should pass custom headers', async () => {
    fetchMock.mockResponses(
        [JSON.stringify(data), { status: 200 }],
        [JSON.stringify(data), { status: 200 }]
    );
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: 'extrakey',
        customHeaders: {
            customheader1: 'header1val',
            customheader2: 'header2val',
        },
    };
    const client = new ToggledClient(config);
    await client.start();
    jest.advanceTimersByTime(1001);

    const featureRequest = getTypeSafeRequest(fetchMock, 0);

    expect(featureRequest.headers).toMatchObject({
        customheader1: 'header1val',
        customheader2: 'header2val',
    });

    client.isEnabled('count-metrics');
    jest.advanceTimersByTime(2001);

    const metricsRequest = getTypeSafeRequest(fetchMock, 1);

    expect(metricsRequest.headers).toMatchObject({
        customheader1: 'header1val',
        customheader2: 'header2val',
    });
});

// Impression events are not currently supported
test('Should emit impression events on getValue calls', (done) => {
    const bootstrap = [
        {
            toggleName: 'impression-value',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValueType: TOGGLES_VALUE_TYPES.STRING,
            toggleValue: 'the-value',
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        impressionDataAll: true,
        bootstrap,
    };
    const client = new ToggledClient(config);
    client.start();

    client.on(EVENTS.READY, () => {
        const value = client.getValue('impression-value');
        expect(value).toBe('the-value');
    });

    client.on(EVENTS.IMPRESSION, (event: any) => {
        expect(event.featureName).toBe('impression-value');
        expect(event.eventType).toBe('getValue');
        client.stop();
        done();
    });
});

test('Should not emit impression events on isEnabled calls when impressionDataAll is false', (done) => {
    const bootstrap = [
        {
            toggleName: 'impression',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValueType: TOGGLES_VALUE_TYPES.STRING,
            toggleValue: 'the-value',
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        impressionDataAll: false,
        bootstrap,
    };
    const client = new ToggledClient(config);
    client.start();

    client.on(EVENTS.READY, () => {
        const isEnabled = client.isEnabled('impression');
        expect(isEnabled).toBe(true);
        client.stop();
        done();
    });

    client.on(EVENTS.IMPRESSION, () => {
        client.stop();
        fail('SDK should not emit impression event');
    });
});

// test('Should emit impression events on isEnabled calls when impressionData is false and impressionDataAll is true', (done) => {
//     const bootstrap = [
//         {
//             name: 'impression',
//             enabled: true,
//             variant: {
//                 name: 'disabled',
//                 enabled: false,
//             },
//             impressionData: false,
//         },
//     ];

//     const config: IConfig = {
//         url: TOGGLED_PLATFORM_URLS.TEST,
//         clientKey: '12',
//
//         bootstrap,
//         impressionDataAll: true,
//     };
//     const client = new ToggledClient(config);
//     client.start();

//     client.on(EVENTS.READY, () => {
//         const isEnabled = client.isEnabled('impression');
//         expect(isEnabled).toBe(true);
//     });

//     client.on(EVENTS.IMPRESSION, (event: any) => {
//         try {
//             expect(event.featureName).toBe('impression');
//             expect(event.eventType).toBe('isEnabled');
//             expect(event.impressionData).toBe(false);
//             client.stop();
//             done();
//         } catch (e) {
//             client.stop();
//             done(e);
//         }
//     });
// });

test('Should emit impression events on isEnabled calls when toggle is unknown and impressionDataAll is true', (done) => {
    const bootstrap = [
        {
            toggleName: 'impression-value',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValueType: TOGGLES_VALUE_TYPES.STRING,
            toggleValue: 'the-value',
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        bootstrap,
        impressionDataAll: true,
    };
    const client = new ToggledClient(config);
    client.start();

    client.on(EVENTS.READY, () => {
        const isEnabled = client.isEnabled('unknown');
        expect(isEnabled).toBe(true);
    });

    client.on(EVENTS.IMPRESSION, (event: any) => {
        expect(event.featureName).toBe('unknown');
        expect(event.eventType).toBe('isEnabled');
        expect(event.enabled).toBe(false);
        client.stop();
        done();
    });
});

test('Should publish ready only when the first fetch was successful', async () => {
    fetchMock.mockResponse(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 1,
    };
    const client = new ToggledClient(config);
    await client.start();

    let readyCount = 0;

    client.on(EVENTS.READY, () => {
        const isEnabled = client.isEnabled('simpleToggle');
        expect(isEnabled).toBe(true);
        readyCount++;
        client.stop();
        expect(readyCount).toEqual(1);
    });

    jest.advanceTimersByTime(1001);
    jest.advanceTimersByTime(1001);

    expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('Should be able to configure ToggledClient with a URL instance', () => {
    const url = new URL('test', 'http://localhost');
    const config: IConfig = {
        url,
        clientKey: '12',
    };
    const client = new ToggledClient(config);
    expect(client).toHaveProperty('url', url);
});

test("Should update toggles even when refresh interval is set to '0'", async () => {
    fetchMock.mockResponse(JSON.stringify(data));
    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        refreshInterval: 0,
    };
    const client = new ToggledClient(config);
    await client.start();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await client.updateContext({ userId: '123' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([null, undefined])(
    'Setting a context field to %s should clear it from the context',
    async () => {
        fetchMock.mockResponse(JSON.stringify(data));
        const config: IConfig = {
            url: TOGGLED_PLATFORM_URLS.TEST,
            clientKey: '12',
        };
        const client = new ToggledClient(config);
        await client.start();

        await client.updateContext({ userId: '123' });
        expect(client.getContext().userId).toEqual('123');

        const userId = undefined;
        await client.updateContext({ userId });

        expect(client.getContext().userId).toBeUndefined();
    }
);

test('Should report metrics', async () => {
    const toggles: IToggle[] = [
        {
            toggleName: 'toggle',
            toggleStatus: TOGGLES_STATUS.ON,
            toggleValue: true,
            toggleValueType: TOGGLES_VALUE_TYPES.BOOLEAN,
        },
    ];

    const config: IConfig = {
        url: TOGGLED_PLATFORM_URLS.TEST,
        clientKey: '12',
        fetch: async () => {
            return {
                ok: true,
                headers: new Map(),
                async json() {
                    return { items: toggles };
                },
            };
        },
    };
    const client = new ToggledClient(config);
    await client.start();

    client.getValue('toggle');
    client.getValue('non-existent-toggle');
    jest.advanceTimersByTime(2500); // fist metric sent after 2 seconds

    const data = await new Promise((resolve) => {
        client.on(EVENTS.SENT, (data: any) => {
            resolve(data);
        });
    });
    expect(data).toMatchObject({
        bucket: {
            toggles: {
                'non-existent-toggle': {
                    enable_count: 0,
                    disable_count: 1,
                },
                toggle: {
                    enable_count: 1,
                    disable_count: 0,
                },
            },
        },
    });
    client.stop();
});

test('Should require GET requests', () => {
    expect(() => {
        new ToggledClient({
            url: TOGGLED_PLATFORM_URLS.TEST,
            clientKey: '12',
            usePOSTrequests: true,
        });
    }).toThrow();
});

test('Should require x-api-key as header name for key', () => {
    expect(() => {
        new ToggledClient({
            url: TOGGLED_PLATFORM_URLS.TEST,
            clientKey: '12',
            headerName: 'another-auth-header',
        });
    }).toThrow();
});
