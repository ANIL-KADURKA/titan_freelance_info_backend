export enum UserRole {
  ADMIN = 'admin',
  RECRUITER = 'recruiter',
  EMPLOYEE = 'employee',
  CANDIDATE = 'candidate',
}

export const DEFAULT_USER_ROLE = UserRole.CANDIDATE;
export const USER_ROLES = Object.values(UserRole);
