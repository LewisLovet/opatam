import { NextRequest, NextResponse } from 'next/server';
import { memberService } from '@booking-app/firebase';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code d\'accès requis' },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    if (normalizedCode.length < 3) {
      return NextResponse.json(
        { error: 'Code d\'accès invalide' },
        { status: 400 }
      );
    }

    const member = await memberService.getMemberByAccessCode(normalizedCode);

    if (!member) {
      return NextResponse.json(
        { error: 'Code d\'accès invalide' },
        { status: 401 }
      );
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'Ce compte est désactivé' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      memberId: member.id,
      providerId: member.providerId,
      memberName: member.name,
      accessCode: normalizedCode,
    });
  } catch (error) {
    console.error('Planning auth error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
