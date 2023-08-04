import { TinyEmitter } from 'tiny-emitter';
import Metrics from './metrics';
import type IStorageProvider from './storage-provider';
import InMemoryStorageProvider from './storage-provider-inmemory';
import LocalStorageProvider from './storage-provider-local';
import EventsHandler from './events-handler';
import { notNullOrUndefined, urlWithContextAsQuery } from './util';

type IContext = {
    [key: string]: string | undefined;
};

interface IConfig {
    url: URL | string | TOGGLED_PLATFORM_URLS;
    clientKey: string;
    disableRefresh?: boolean;
    refreshInterval?: number;
    metricsInterval?: number;
    disableMetrics?: boolean;
    storageProvider?: IStorageProvider;
    context?: IContext;
    fetch?: any;
    bootstrap?: IToggle[];
    bootstrapOverride?: boolean;
    headerName?: string;
    customHeaders?: Record<string, string>;
    impressionDataAll?: boolean;
    usePOSTrequests?: boolean;
}

interface IToggle {
    toggleName: string;
    toggleValue: boolean | string;
    toggleValueType: TOGGLES_VALUE_TYPES;
    toggleStatus: TOGGLES_STATUS;
}

export const EVENTS = {
    INIT: 'initialized',
    ERROR: 'error',
    READY: 'ready',
    UPDATE: 'update',
    IMPRESSION: 'impression',
    SENT: 'sent',
};

export enum TOGGLES_VALUE_TYPES {
    STRING = 'string',
    BOOLEAN = 'boolean',
}

export enum TOGGLES_STATUS {
    ON = 'on',
    OFF = 'off',
}

export enum TOGGLED_PLATFORM_URLS {
    USE1 = 'https://us-east-1-api.saas.toggled.dev/client/features',
    EUC1 = 'https://eu-central-1-api.saas.toggled.dev/client/features',
    APS1 = 'https://ap-south-1-api.saas.toggled.dev/client/features',

    TEST = 'http://localhost/test',
}

// const IMPRESSION_EVENTS = {
//     IS_ENABLED: 'isEnabled',
//     GET_VARIANT: 'getVariant',
// };

const storeKey = 'repo';

export const resolveFetch = () => {
    try {
        if (typeof window !== 'undefined' && 'fetch' in window) {
            return fetch.bind(window);
        } else if ('fetch' in globalThis) {
            return fetch.bind(globalThis);
        }
    } catch (e) {
        console.error('Toggled failed to resolve "fetch"', e);
    }

    return undefined;
};

export class ToggledClient extends TinyEmitter {
    private toggles: IToggle[] = [];
    private impressionDataAll: boolean;
    private context: IContext;
    private timerRef?: any;
    private storage: IStorageProvider;
    private refreshInterval: number;
    private url: URL;
    private clientKey: string;
    private sessionId?: string;
    private etag = '';
    private metrics: Metrics;
    private ready: Promise<void>;
    private fetch: any;
    private bootstrap?: IToggle[];
    private bootstrapOverride: boolean;
    private headerName: string;
    private eventsHandler: EventsHandler;
    private customHeaders: Record<string, string>;
    private readyEventEmitted = false;
    private usePOSTrequests = false;
    private started = false;

    constructor({
        storageProvider,
        url,
        clientKey,
        disableRefresh = false,
        refreshInterval = 30,
        metricsInterval = 30,
        disableMetrics = true,
        context,
        fetch = resolveFetch(),
        bootstrap,
        bootstrapOverride = true,
        headerName = 'x-api-key',
        customHeaders = {},
        impressionDataAll = false,
        usePOSTrequests = false,
    }: IConfig) {
        super();
        // Validations
        if (!url) {
            throw new Error('url is required');
        }
        if (!clientKey) {
            throw new Error('clientKey is required');
        }
        if (!disableMetrics) {
            throw new Error('metrics are not currently supported.');
        }
        if (usePOSTrequests) {
            throw new Error('POST requests are not currently supported.');
        }
        this.eventsHandler = new EventsHandler();
        this.impressionDataAll = impressionDataAll;
        this.toggles = bootstrap && bootstrap.length > 0 ? bootstrap : [];
        this.url = url instanceof URL ? url : new URL(url);
        this.clientKey = clientKey;
        this.headerName = headerName;
        this.customHeaders = customHeaders;
        this.storage =
            storageProvider ||
            (typeof window !== 'undefined'
                ? new LocalStorageProvider()
                : new InMemoryStorageProvider());
        this.refreshInterval = disableRefresh ? 0 : refreshInterval * 1000;
        this.context = { ...context };
        this.usePOSTrequests = usePOSTrequests;
        this.ready = new Promise((resolve) => {
            this.init()
                .then(resolve)
                .catch((error) => {
                    console.error(error);
                    this.emit(EVENTS.ERROR, error);
                    resolve();
                });
        });

        if (!fetch) {
            console.error(
                'Toggled: You must either provide your own "fetch" implementation or run in an environment where "fetch" is available.'
            );
        }

        this.fetch = fetch;
        this.bootstrap =
            bootstrap && bootstrap.length > 0 ? bootstrap : undefined;
        this.bootstrapOverride = bootstrapOverride;

        this.metrics = new Metrics({
            onError: this.emit.bind(this, EVENTS.ERROR),
            onSent: this.emit.bind(this, EVENTS.SENT),
            appName: 'metrics', //TODO REMOVE THIS
            metricsInterval,
            disableMetrics,
            url: this.url,
            clientKey,
            fetch,
            headerName,
            customHeaders,
        });
    }

    public getAllToggles(): IToggle[] {
        return [...this.toggles];
    }

    public isEnabled(toggleName: string): boolean {
        const toggle = this.toggles.find((t) => t.toggleName === toggleName);
        const enabled = toggle
            ? toggle.toggleStatus === TOGGLES_STATUS.ON &&
              (toggle.toggleValueType === TOGGLES_VALUE_TYPES.BOOLEAN
                  ? Boolean(toggle.toggleValue)
                  : true)
            : false;

        // this.metrics.count(toggleName, enabled);
        // if (toggle?.impressionData || this.impressionDataAll) {
        //     const event = this.eventsHandler.createImpressionEvent(
        //         this.context,
        //         enabled,
        //         toggleName,
        //         IMPRESSION_EVENTS.IS_ENABLED,
        //         toggle?.impressionData ?? undefined
        //     );
        //     this.emit(EVENTS.IMPRESSION, event);
        // }

        return enabled;
    }

    public getValue(toggleName: string): boolean | string | undefined {
        const toggle = this.toggles.find((t) => t.toggleName === toggleName);
        
        const variant = toggle ? toggle.toggleValue : undefined;

        // const enabled = toggle?.enabled || false;
        // if (variant.name) {
        //     this.metrics.countVariant(toggleName, variant.name);
        // }
        // this.metrics.count(toggleName, enabled);
        // if (toggle?.impressionData || this.impressionDataAll) {
        //     const event = this.eventsHandler.createImpressionEvent(
        //         this.context,
        //         enabled,
        //         toggleName,
        //         IMPRESSION_EVENTS.GET_VARIANT,
        //         toggle?.impressionData ?? undefined,
        //         variant.name
        //     );
        //     this.emit(EVENTS.IMPRESSION, event);
        // }
        return variant;
    }

    public async updateContext(context: IContext): Promise<void> {
        this.context = { ...context };

        if (this.timerRef || this.readyEventEmitted) {
            await this.fetchToggles();
        } else if (this.started) {
            await new Promise<void>((resolve) => {
                const listener = () => {
                    this.fetchToggles().then(() => {
                        this.off(EVENTS.READY, listener);
                        resolve();
                    });
                };
                this.once(EVENTS.READY, listener);
            });
        }
    }

    public getContext() {
        return { ...this.context };
    }

    public setContextField(field: string, value: string) {
        this.context = { ...this.context, [field]: value };
        if (this.timerRef) {
            this.fetchToggles();
        }
    }

    public getCurrentSessionId() {
        return this.sessionId;
    }

    private async init(): Promise<void> {
        this.sessionId = await this.resolveSessionId();
        this.toggles = (await this.storage.get(storeKey)) || [];

        if (
            this.bootstrap &&
            (this.bootstrapOverride || this.toggles.length === 0)
        ) {
            await this.storage.save(storeKey, this.bootstrap);
            this.toggles = this.bootstrap;
            this.emit(EVENTS.READY);
        }
        this.emit(EVENTS.INIT);
    }

    public async start(): Promise<void> {
        this.started = true;
        if (this.timerRef) {
            console.error(
                'Toggled SDK has already started, if you want to restart the SDK you should call client.stop() before starting again.'
            );
            return;
        }
        await this.ready;
        this.metrics.start();
        const interval = this.refreshInterval;

        await this.fetchToggles();

        if (interval > 0) {
            this.timerRef = setInterval(() => this.fetchToggles(), interval);
        }
    }

    public stop(): void {
        if (this.timerRef) {
            clearInterval(this.timerRef);
            this.timerRef = undefined;
        }
        this.metrics.stop();
    }

    private async resolveSessionId(): Promise<string> {
        return await this.storage.get('sessionId');
    }

    private getHeaders() {
        const headers = {
            [this.headerName]: this.clientKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'If-None-Match': this.etag,
        };
        Object.entries(this.customHeaders)
            .filter(notNullOrUndefined)
            .forEach(([name, value]) => (headers[name] = value));
        if (this.sessionId) {
            headers['session-id'] = this.sessionId;
        }
        return headers;
    }

    private async storeToggles(toggles: IToggle[]): Promise<void> {
        this.toggles = toggles;
        this.emit(EVENTS.UPDATE);
        await this.storage.save(storeKey, toggles);
    }

    private async fetchToggles() {
        if (this.fetch) {
            try {
                const isPOST = this.usePOSTrequests;

                const url = isPOST
                    ? this.url
                    : urlWithContextAsQuery(this.url, this.context);
                const method = isPOST ? 'POST' : 'GET';
                const body = isPOST
                    ? JSON.stringify({ context: this.context })
                    : undefined;

                const response = await this.fetch(url.toString(), {
                    method,
                    cache: 'no-cache',
                    headers: this.getHeaders(),
                    body,
                });
                if (response.ok && response.status !== 304) {
                    this.etag = response.headers.get('ETag') || '';
                    const data = await response.json();
                    await this.storeToggles(data.items);

                    this.sessionId = data['session-id'];
                    await this.storage.save('sessionId', this.sessionId);

                    if (!this.bootstrap && !this.readyEventEmitted) {
                        this.emit(EVENTS.READY);
                        this.readyEventEmitted = true;
                    }
                } else if (!response.ok && response.status !== 304) {
                    console.error(
                        'Toggled: Fetching feature toggles did not have an ok response'
                    );
                    this.emit(EVENTS.ERROR, {
                        type: 'HttpError',
                        code: response.status,
                    });
                }
            } catch (e) {
                console.error('Toggled: unable to fetch feature toggles', e);
                this.emit(EVENTS.ERROR, e);
            }
        }
    }
}

// export storage providers from root module
export { IStorageProvider, LocalStorageProvider, InMemoryStorageProvider };

export type { IConfig, IContext, IToggle };
