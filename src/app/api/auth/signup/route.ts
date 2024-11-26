// src/app/api/auth/signup/route.ts
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password, idAddress } = await request.json();

    // Validate input
    if (!email || !password || !idAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user already exists
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({ where: { email } });
    } catch (error) {
      console.error('Error checking existing user:', error);
      throw error;
    }

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash the password
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw error;
    }

    // Create the new user
    try {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          idAddress,
        },
      });
    } catch (error) {
      console.error('Error creating user in database:', error);
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in signup POST handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}