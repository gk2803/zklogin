export function buildGoogleAuthUrl(params: {
    clientId: string, 
    redirectUri: string,
    responseType?: string,
    scope?: string,
    nonce: string
}) {
    const {clientId, redirectUri, responseType = "id_token", nonce, scope = "openid email" } = params;
    const qp = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope,
        nonce
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${qp}`;
}