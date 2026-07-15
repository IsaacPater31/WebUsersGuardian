import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
    EmailAuthProvider,
    linkWithCredential,
    reauthenticateWithCredential,
    updatePassword,
    updateProfile,
} from 'firebase/auth';
import { auth, db } from '@/shared/api/firebase';
import { Collections } from '@/shared/config/collections';
import { UserFields } from '@/shared/config/firestoreFields';
import { userHasPasswordProvider } from '@/features/auth/utils/authProviders';

export async function updateUserProfile({ displayName }) {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay sesión activa');
    const name = String(displayName || '').trim();
    if (!name) throw new Error('El nombre es obligatorio');
    await updateProfile(user, { displayName: name });
    await updateDoc(doc(db, Collections.USERS, user.uid), {
        [UserFields.displayName]: name,
        [UserFields.name]: name,
        full_name: name,
        [UserFields.updatedAt]: serverTimestamp(),
    });
}

export async function setInitialPassword({ newPassword }) {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No hay sesión activa');
    if (userHasPasswordProvider(user)) {
        throw new Error('Ya tienes una contraseña configurada');
    }
    if (!newPassword || newPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    const credential = EmailAuthProvider.credential(user.email, newPassword);
    await linkWithCredential(user, credential);
}

export async function changeUserPassword({ currentPassword, newPassword }) {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No hay sesión activa');
    if (!userHasPasswordProvider(user)) {
        throw new Error('No tienes contraseña configurada. Usa "Crear contraseña" en su lugar.');
    }
    if (!newPassword || newPassword.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}
