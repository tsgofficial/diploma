import createNextIntlPlugin from 'next-intl/plugin';

// Locale comes from a cookie (see i18n/request.ts), not from the URL.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };

export default withNextIntl(nextConfig);
