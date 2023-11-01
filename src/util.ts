import { IContext } from '.';

export const notNullOrUndefined = ([, value]: [string, string]) =>
    value !== undefined && value !== null;

export const urlWithContextAsQuery = (url: URL, context: IContext) => {
    const urlWithQuery = new URL(url.toString());
    // Add context information to url search params
    Object.entries(context).forEach(([contextKey, contextValue]) => {
        if (contextValue !== undefined && contextValue !== null) {
            urlWithQuery.searchParams.append(contextKey, contextValue);
        }
    });
    return urlWithQuery;
};

export const clientIdentifier = 'js-v1';
