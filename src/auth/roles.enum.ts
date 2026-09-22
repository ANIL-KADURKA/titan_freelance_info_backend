export enum UserRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  EMPLOYEE = 'EMPLOYEE',
  CANDIDATE = 'CANDIDATE',
}

export const DEFAULT_USER_ROLE = UserRole.CANDIDATE;
export const USER_ROLES = Object.values(UserRole);
