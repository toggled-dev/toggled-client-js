import { FetchMock } from 'jest-fetch-mock';
import Metrics from './metrics';
import { getTypeSafeRequest, parseRequestBodyWithType } from './test';

jest.useFakeTimers();

const fetchMock = fetch as FetchMock;

afterEach(() => {
    fetchMock.resetMocks();
    jest.clearAllTimers();
});

test('should be disabled by flag disableMetrics', async () => {
    const metrics = new Metrics({
        onError: console.error,
        metricsInterval: 0,
        disableMetrics: true,
        url: 'http://localhost:3000',
        clientKey: '123',
        fetch: fetchMock,
        headerName: 'Authorization',
    });

    metrics.count('foo', true);

    await metrics.sendMetrics();

    expect(fetchMock.mock.calls.length).toEqual(0);
});

test('should send metrics', async () => {
    const metrics = new Metrics({
        onError: console.error,
        metricsInterval: 0,
        disableMetrics: false,
        url: 'http://localhost:3000',
        clientKey: '123',
        fetch: fetchMock,
        headerName: 'Authorization',
    });

    metrics.count('foo', true);
    metrics.count('foo', true);
    metrics.count('foo', false);
    metrics.count('bar', false);
    //metrics.countVariant('foo', 'foo-variant');
    //metrics.countVariant('foo', 'foo-variant');

    await metrics.sendMetrics();

    expect(fetchMock.mock.calls.length).toEqual(1);

    /** Parse request and get its body with casted type */
    const request = getTypeSafeRequest(fetchMock);
    const body = parseRequestBodyWithType<{ bucket: Metrics['bucket'] }>(
        request
    );

    expect(body.bucket.toggles.foo.enable_count).toEqual(2);
    expect(body.bucket.toggles.foo.disable_count).toEqual(1);
    expect(body.bucket.toggles.bar.enable_count).toEqual(0);
    expect(body.bucket.toggles.bar.disable_count).toEqual(1);
    //expect(body.bucket.toggles.foo.variants).toEqual({ 'foo-variant': 2 });
});

test('should send metrics with custom auth header', async () => {
    const metrics = new Metrics({
        onError: console.error,
        metricsInterval: 0,
        disableMetrics: false,
        url: 'http://localhost:3000',
        clientKey: '123',
        fetch: fetchMock,
        headerName: 'NotAuthorization',
    });

    metrics.count('foo', true);
    await metrics.sendMetrics();

    const requestBody = getTypeSafeRequest(fetchMock);

    expect(fetchMock.mock.calls.length).toEqual(1);
    expect(requestBody.headers).toMatchObject({
        NotAuthorization: '123',
    });
});

test('Should send initial metrics after 2 seconds', () => {
    const metrics = new Metrics({
        onError: console.error,
        metricsInterval: 5,
        disableMetrics: false,
        url: 'http://localhost:3000',
        clientKey: '123',
        fetch: fetchMock,
        headerName: 'Authorization',
    });

    metrics.start();

    metrics.count('foo', true);
    metrics.count('foo', true);
    metrics.count('foo', false);
    metrics.count('bar', false);
    // Account for 2 second timeout before the set interval starts
    jest.advanceTimersByTime(2000);
    expect(fetchMock.mock.calls.length).toEqual(1);
});

test('should send metrics based on timer interval', async () => {
    const metrics = new Metrics({
        onError: console.error,
        metricsInterval: 5,
        disableMetrics: false,
        url: new URL('http://localhost:3000'),
        clientKey: '123',
        fetch: fetchMock,
        headerName: 'Authorization',
    });

    metrics.start();

    metrics.count('foo', true);
    metrics.count('foo', true);
    metrics.count('foo', false);
    metrics.count('bar', false);
    // Account for 2 second timeout before the set interval starts
    jest.advanceTimersByTime(2000);

    metrics.count('foo', true);
    metrics.count('foo', true);
    metrics.count('foo', false);
    metrics.count('bar', false);
    // Fill bucket and advance the interval
    jest.advanceTimersByTime(5000);

    metrics.count('foo', true);
    metrics.count('foo', true);
    metrics.count('foo', false);
    metrics.count('bar', false);
    // Fill bucket and advance the interval
    jest.advanceTimersByTime(5000);

    expect(fetchMock.mock.calls.length).toEqual(3);
});

describe('Custom headers for metrics', () => {
    const runMetrics = async (customHeaders: Record<string, string>) => {
        const metrics = new Metrics({
            onError: console.error,
            metricsInterval: 5,
            disableMetrics: false,
            url: 'http://localhost:3000',
            clientKey: '123',
            fetch: fetchMock,
            headerName: 'Authorization',
            customHeaders,
        });

        metrics.count('foo', true);
        await metrics.sendMetrics();

        return getTypeSafeRequest(fetchMock);
    };

    test('Should apply any custom headers to the metrics request', async () => {
        const customHeaders = {
            'x-custom-header': '123',
        };

        const requestBody = await runMetrics(customHeaders);
        expect(requestBody.headers).toMatchObject(customHeaders);
    });

    test('Custom headers should override preset headers', async () => {
        const customHeaders = {
            Authorization: 'definitely-not-the-client-key',
        };

        const requestBody = await runMetrics(customHeaders);
        expect(requestBody.headers).toMatchObject(customHeaders);
    });

    test('Empty custom headers do not override preset headers on collision', async () => {
        const customHeaders = {
            Authorization: null,
        };

        // @ts-expect-error this shouldn't be allowed in TS, but there's
        // nothing stopping you from doing it in JS.
        const requestBody = await runMetrics(customHeaders);
        expect(requestBody.headers).not.toMatchObject(customHeaders);
    });

    test.each([null, undefined])(
        'Custom headers that are "%s" should not be sent',
        async (emptyValue) => {
            const customHeaders = {
                'invalid-header': emptyValue,
            };

            // @ts-expect-error this shouldn't be allowed in TS, but there's
            // nothing stopping you from doing it in JS.
            const requestBody = await runMetrics(customHeaders);

            expect(requestBody.headers).not.toMatchObject(customHeaders);
        }
    );
});
