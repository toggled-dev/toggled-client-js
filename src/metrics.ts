import { notNullOrUndefined, clientIdentifier } from './util';

export interface MetricsOptions {
    onError: OnError;
    onSent?: OnSent;
    metricsInterval: number;
    disableMetrics?: boolean;
    url: URL | string;
    clientKey: string;
    fetch: any;
    headerName: string;
    customHeaders?: Record<string, string>;
}

interface Bucket {
    start: Date;
    stop: Date | null;
    toggles: {
        [s: string]: { enable_count: number; disable_count: number };
    };
}

interface Payload {
    bucket: Bucket;
}

type OnError = (error: unknown) => void;
type OnSent = (payload: Payload) => void;
// eslint-disable-next-line @typescript-eslint/no-empty-function
const doNothing = () => {};

export default class Metrics {
    private onError: OnError;
    private onSent: OnSent;
    private bucket: Bucket;
    private metricsInterval: number;
    private disabled: boolean;
    private url: URL;
    private clientKey: string;
    private timer: any;
    private fetch: any;
    private headerName: string;
    private customHeaders: Record<string, string>;

    constructor({
        onError,
        onSent,
        metricsInterval,
        disableMetrics = true,
        url,
        clientKey,
        fetch,
        headerName,
        customHeaders = {},
    }: MetricsOptions) {
        this.onError = onError;
        this.onSent = onSent || doNothing;
        this.disabled = disableMetrics;
        this.metricsInterval = metricsInterval * 1000;
        this.url = url instanceof URL ? url : new URL(url);
        this.clientKey = clientKey;
        this.bucket = this.createEmptyBucket();
        this.fetch = fetch;
        this.headerName = headerName;
        this.customHeaders = customHeaders;
    }

    public start() {
        if (this.disabled) {
            return false;
        }

        if (
            typeof this.metricsInterval === 'number' &&
            this.metricsInterval > 0
        ) {
            // send first metrics after two seconds.
            setTimeout(() => {
                this.startTimer();
                this.sendMetrics();
            }, 2000);
        }
    }

    public stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            delete this.timer;
        }
    }

    public createEmptyBucket(): Bucket {
        return {
            start: new Date(),
            stop: null,
            toggles: {},
        };
    }

    private getHeaders() {
        const headers = {
            [this.headerName]: this.clientKey,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Toggled-Client-Version': clientIdentifier,
        };

        Object.entries(this.customHeaders)
            .filter(notNullOrUndefined)
            .forEach(([name, value]) => (headers[name] = value));

        return headers;
    }

    public async sendMetrics(): Promise<void> {
        /* istanbul ignore next if */

        const url = `${this.url}/usage`;
        const payload = this.getPayload();

        if (this.bucketIsEmpty(payload)) {
            return;
        }

        try {
            await this.fetch(url, {
                cache: 'no-cache',
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
            });
            this.onSent(payload);
        } catch (e) {
            console.error('Toggled: unable to send feature metrics', e);
            this.onError(e);
        }
    }

    public count(name: string, enabled: boolean): boolean {
        if (this.disabled || !this.bucket) {
            return false;
        }
        this.assertBucket(name);
        this.bucket.toggles[name][enabled ? 'enable_count' : 'disable_count']++;
        return true;
    }

    // public countVariant(name: string, variant: string): boolean {
    //     if (this.disabled || !this.bucket) {
    //         return false;
    //     }
    //     this.assertBucket(name);
    //     if (this.bucket.toggles[name].variants[variant]) {
    //         this.bucket.toggles[name].variants[variant] += 1;
    //     } else {
    //         this.bucket.toggles[name].variants[variant] = 1;
    //     }
    //     return true;
    // }

    private assertBucket(name: string) {
        if (this.disabled || !this.bucket) {
            return false;
        }
        if (!this.bucket.toggles[name]) {
            this.bucket.toggles[name] = {
                enable_count: 0,
                disable_count: 0,
                //variants: {},
            };
        }
    }

    private startTimer(): void {
        this.timer = setInterval(() => {
            this.sendMetrics();
        }, this.metricsInterval);
    }

    private bucketIsEmpty(payload: Payload) {
        return Object.keys(payload.bucket.toggles).length === 0;
    }

    private getPayload(): Payload {
        const bucket = { ...this.bucket, stop: new Date() };
        this.bucket = this.createEmptyBucket();

        return {
            bucket,
        };
    }
}
