import type { ApplicationStatus } from '@prisma/client';
import type { NotificationInput } from './notifications.service.js';

/** Wording for every notification, in one place. */

export function personName(person: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) {
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
    person.email
  );
}

export function applicationSubmitted(project: string): NotificationInput {
  return {
    type: 'APPLICATION_SUBMITTED',
    title: 'Application submitted',
    message: `We've received your application for ${project}. We'll update you here as the team reviews it.`,
    link: '/projects/applied',
  };
}

export function applicationReceived(
  candidate: string,
  project: string,
  applicationId: string,
): NotificationInput {
  return {
    type: 'APPLICATION_RECEIVED',
    title: 'New application',
    message: `${candidate} applied to ${project}.`,
    link: `/admin/applications/${applicationId}`,
  };
}

export function applicationWithdrawn(
  candidate: string,
  project: string,
  applicationId: string,
): NotificationInput {
  return {
    type: 'APPLICATION_WITHDRAWN',
    title: 'Application withdrawn',
    message: `${candidate} withdrew their application to ${project}.`,
    link: `/admin/applications/${applicationId}`,
  };
}

const statusCopy: Partial<
  Record<ApplicationStatus, { title: string; message: string; link: string }>
> = {
  IN_REVIEW: {
    title: 'Application in review',
    message: 'The team is now reviewing your application for {project}.',
    link: '/projects/applied',
  },
  SHORTLISTED: {
    title: "You're shortlisted",
    message:
      "Good news — you're shortlisted for {project}. Watch your email for the next step.",
    link: '/projects/applied',
  },
  INTERVIEW: {
    title: 'Call scheduled',
    message:
      'A call has been scheduled for {project}. Check your email for the time and joining details.',
    link: '/projects/applied',
  },
  OFFERED: {
    title: "You've received an offer",
    message:
      "You've been offered a place on {project}. Check your email to accept.",
    link: '/projects/applied',
  },
  HIRED: {
    title: "You're selected",
    message: "Congratulations! You've been selected for {project}.",
    link: '/projects/current',
  },
  COMPLETED: {
    title: 'Project completed',
    message: '{project} is marked complete. Thanks for your work!',
    link: '/projects/completed',
  },
  REJECTED: {
    title: 'Application update',
    message:
      "You weren't selected for {project} this time. Keep an eye out for new projects.",
    link: '/projects/applied',
  },
};

/** Null for statuses candidates don't need to hear about (e.g. APPLIED). */
export function applicationStatusChanged(
  status: ApplicationStatus,
  project: string,
): NotificationInput | null {
  const copy = statusCopy[status];
  if (!copy) return null;
  return {
    type: 'APPLICATION_STATUS',
    title: copy.title,
    message: copy.message.replace('{project}', project),
    link: copy.link,
  };
}

export function applicationSelected(
  project: string,
  resent: boolean,
): NotificationInput {
  return {
    type: 'APPLICATION_SELECTED',
    title: resent ? 'Work account details resent' : "You're selected 🎉",
    message: resent
      ? `We've emailed your work account details for ${project} again. You can also view them on My Projects.`
      : `Congratulations! You've been selected for ${project}. Your work account details are in your email and on My Projects.`,
    link: '/projects/current',
  };
}

export function paymentMethodSubmitted(
  candidate: string,
  method: string,
): NotificationInput {
  return {
    type: 'PAYMENT_METHOD_SUBMITTED',
    title: 'Payout method to verify',
    message: `${candidate} added a ${method}. Review it in Pending Approvals.`,
    link: '/admin/payments',
  };
}

export function paymentMethodReviewed(
  method: string,
  approved: boolean,
  reason?: string | null,
): NotificationInput {
  return {
    type: 'PAYMENT_METHOD_REVIEWED',
    title: approved ? 'Payout method verified' : 'Payout method rejected',
    message: approved
      ? `Your ${method} is verified. Payouts will be sent there.`
      : `Your ${method} couldn't be verified${reason ? `: ${reason}` : '.'} Please add it again with the correct details.`,
    link: '/payouts',
  };
}

export function passwordChanged(reset: boolean): NotificationInput {
  return {
    type: 'ACCOUNT_SECURITY',
    title: reset ? 'Password reset' : 'Password changed',
    message: `Your password was ${reset ? 'reset' : 'changed'} and you were signed out on other devices. If this wasn't you, contact support right away.`,
    link: '/settings',
  };
}

export function welcome(name?: string | null): NotificationInput {
  return {
    type: 'WELCOME',
    title: 'Welcome to Titan',
    message: `${name ? `Hi ${name}, your` : 'Your'} profile is set up. Add a payout method and start applying to projects.`,
    link: '/jobs',
  };
}

export function candidateJoined(candidate: string): NotificationInput {
  return {
    type: 'CANDIDATE_JOINED',
    title: 'New candidate joined',
    message: `${candidate} finished onboarding.`,
    link: '/admin/users',
  };
}

export function timesheetSubmitted(
  candidate: string,
  project: string,
  workDate: string,
  quantity: string,
  resubmitted: boolean,
): NotificationInput {
  return {
    type: 'TIMESHEET_SUBMITTED',
    title: resubmitted ? 'Timesheet updated' : 'Timesheet to review',
    message: `${candidate} ${resubmitted ? 'updated' : 'logged'} ${quantity} on ${project} for ${workDate}.`,
    link: '/admin/timesheets',
  };
}

export function timesheetsReviewed(
  count: number,
  approved: boolean,
  amount: string,
  projects: string,
  reason?: string | null,
): NotificationInput {
  const days = `${count} ${count === 1 ? 'day' : 'days'}`;
  return {
    type: 'TIMESHEET_REVIEWED',
    title: approved ? 'Timesheet approved' : 'Timesheet rejected',
    message: approved
      ? `${days} on ${projects} approved — ${amount} added to your pending payment.`
      : `${days} on ${projects} rejected${reason ? `: ${reason}` : '.'} Fix and resubmit from Time Sheets.`,
    link: '/timesheets',
  };
}

export function payoutSent(
  amount: string,
  entries: number,
  reference?: string | null,
): NotificationInput {
  return {
    type: 'PAYOUT_SENT',
    title: 'Payment sent 💸',
    message: `${amount} for ${entries} approved ${entries === 1 ? 'day' : 'days'} has been paid${reference ? ` (ref ${reference})` : ''}. The receipt is on your Payouts page.`,
    link: '/payouts',
  };
}

/** A community post went live (announcement or new project). */
export function communityPost(post: {
  title: string;
  body: string;
  type: 'ANNOUNCEMENT' | 'NEW_PROJECT';
  jobSlug?: string | null;
}): NotificationInput {
  const preview = post.body.replace(/\s+/g, ' ').trim();
  return {
    type: 'COMMUNITY_POST',
    title: post.type === 'NEW_PROJECT' ? post.title : `📣 ${post.title}`,
    message: preview.length > 160 ? `${preview.slice(0, 159)}…` : preview,
    link:
      post.type === 'NEW_PROJECT' && post.jobSlug
        ? `/jobs/${post.jobSlug}`
        : '/community',
  };
}

export function agreementUpdated(
  version: string,
  changeNote: string | null,
): NotificationInput {
  return {
    type: 'AGREEMENT_UPDATED',
    title: `Trainer agreement updated (${version})`,
    message: `${changeNote ? `${changeNote}. ` : ''}Please review and re-sign it to keep working on projects.`,
    link: '/agreements',
  };
}

export function testimonialSubmitted(
  candidate: string,
  isEdit: boolean,
): NotificationInput {
  return {
    type: 'TESTIMONIAL_SUBMITTED',
    title: isEdit ? 'Testimonial edited' : 'New testimonial to review',
    message: isEdit
      ? `${candidate} edited their live testimonial. Review the changes.`
      : `${candidate} shared a testimonial. Review it before it goes live.`,
    link: '/admin/content/testimonials',
  };
}

export function testimonialReviewed(
  approved: boolean,
  reason?: string | null,
): NotificationInput {
  return approved
    ? {
        type: 'TESTIMONIAL_REVIEWED',
        title: 'Your testimonial is live 🎉',
        message:
          'Thanks for sharing your experience. It now appears on the Titan website.',
        link: '/testimonials/share',
      }
    : {
        type: 'TESTIMONIAL_REVIEWED',
        title: 'Testimonial not approved',
        message: reason
          ? `Reason: ${reason}. You can edit it and submit again.`
          : 'You can edit it and submit again.',
        link: '/testimonials/share',
      };
}

// ── Support tickets ──

export function supportTicketCreated(
  label: string,
  requester: string,
  subject: string,
): NotificationInput {
  return {
    type: 'SUPPORT_TICKET_CREATED',
    title: `New support ticket ${label}`,
    message: `${requester}: ${subject}`,
    link: '/admin/support',
  };
}

/** To the requester when support replies. */
export function supportTicketAnswered(
  label: string,
  ticketId: string,
): NotificationInput {
  return {
    type: 'SUPPORT_TICKET_REPLY',
    title: `Support replied on ${label}`,
    message: 'Open the ticket to read the reply and respond.',
    link: `/support/${ticketId}`,
  };
}

/** To the support team when the requester replies. */
export function supportTicketFollowUp(
  label: string,
  requester: string,
  ticketId: string,
): NotificationInput {
  return {
    type: 'SUPPORT_TICKET_REPLY',
    title: `New reply on ${label}`,
    message: `${requester} replied to their ticket.`,
    link: `/admin/support/${ticketId}`,
  };
}

const supportStatusText: Record<string, string> = {
  OPEN: 'reopened',
  IN_PROGRESS: 'being worked on',
  WAITING: 'waiting for your reply',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export function supportTicketStatusChanged(
  label: string,
  ticketId: string,
  status: string,
): NotificationInput {
  return {
    type: 'SUPPORT_TICKET_STATUS',
    title: `${label} is ${supportStatusText[status] ?? status.toLowerCase()}`,
    message:
      status === 'RESOLVED'
        ? 'If the issue is still there, reply on the ticket to reopen it.'
        : 'Open the ticket for details.',
    link: `/support/${ticketId}`,
  };
}
