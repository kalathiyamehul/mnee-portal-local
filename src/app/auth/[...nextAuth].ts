// pages/api/auth/[...nextauth].ts
import authenticateUser from '@/utils/auth';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials.password) {
                    return null;
                }

                // Implement your user authentication logic here
                const user = await authenticateUser(credentials.email, credentials.password);
                if (user) {
                    return user;
                } else {
                    return null;
                }
            },
        }),
    ],
    // Additional NextAuth.js configuration options
});