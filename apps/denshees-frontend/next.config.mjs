/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Google account avatars. `picture` from the verified Google ID token is
    // served from an lh<n>.googleusercontent.com host, and next/image throws a
    // runtime error for any host that is not listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
