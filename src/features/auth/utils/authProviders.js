export const PROVIDER_PASSWORD = 'password';
export const PROVIDER_GOOGLE = 'google.com';

export function getAuthProviders(user) {
    return user?.providerData?.map((p) => p.providerId) ?? [];
}

export function userHasPasswordProvider(user) {
    return getAuthProviders(user).includes(PROVIDER_PASSWORD);
}

export function userHasGoogleProvider(user) {
    return getAuthProviders(user).includes(PROVIDER_GOOGLE);
}

export function authProviderLabels(user) {
    const labels = [];
    if (userHasGoogleProvider(user)) labels.push('Google');
    if (userHasPasswordProvider(user)) labels.push('Correo y contraseña');
    return labels;
}
