import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const seededPassword = 'Password@123';
const passwordHash = await bcrypt.hash(seededPassword, 12);
const now = new Date();
const nextMonth = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
const nextSixWeeks = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 42);

const roles = [
  ['ADMIN', 'Platform administrator'],
  ['RECRUITER', 'Recruiter role'],
  ['EMPLOYEE', 'Employee role'],
  ['CANDIDATE', 'Candidate role'],
];

const permissions = [
  ['users.read', 'users', 'View user profiles'],
  ['users.manage', 'users', 'Manage user profiles and status'],
  ['jobs.read', 'jobs', 'View jobs'],
  ['jobs.manage', 'jobs', 'Create and manage jobs'],
  ['faq.manage', 'faq', 'Create and manage FAQs'],
  ['testimonials.manage', 'testimonials', 'Create and manage testimonials'],
];

const candidateProfiles = [
  {
    email: 'ananya.rao@example.com',
    firstName: 'Ananya',
    lastName: 'Rao',
    phone: '+919810000101',
    gender: 'FEMALE',
    city: 'Bengaluru',
    state: 'Karnataka',
    occupation: 'Frontend Developer',
    hardSkills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    softSkills: ['Ownership', 'Clear communication', 'Design sense'],
    links: [
      ['LINKEDIN', 'https://linkedin.com/in/ananya-rao'],
      ['GITHUB', 'https://github.com/ananyarao'],
      ['PORTFOLIO', 'https://ananyarao.dev'],
    ],
  },
  {
    email: 'rahul.menon@example.com',
    firstName: 'Rahul',
    lastName: 'Menon',
    phone: '+919810000102',
    gender: 'MALE',
    city: 'Kochi',
    state: 'Kerala',
    occupation: 'Backend Engineer',
    hardSkills: ['NestJS', 'PostgreSQL', 'Prisma', 'AWS'],
    softSkills: ['Debugging', 'Documentation', 'Collaboration'],
    links: [
      ['LINKEDIN', 'https://linkedin.com/in/rahul-menon'],
      ['GITHUB', 'https://github.com/rahulmenon'],
    ],
  },
  {
    email: 'meera.shah@example.com',
    firstName: 'Meera',
    lastName: 'Shah',
    phone: '+919810000103',
    gender: 'FEMALE',
    city: 'Mumbai',
    state: 'Maharashtra',
    occupation: 'Content Strategist',
    hardSkills: ['SEO', 'Copywriting', 'Notion', 'Analytics'],
    softSkills: ['Research', 'Storytelling', 'Stakeholder management'],
    links: [
      ['LINKEDIN', 'https://linkedin.com/in/meera-shah'],
      ['PORTFOLIO', 'https://meerashah.work'],
    ],
  },
  {
    email: 'arjun.iyer@example.com',
    firstName: 'Arjun',
    lastName: 'Iyer',
    phone: '+919810000104',
    gender: 'MALE',
    city: 'Chennai',
    state: 'Tamil Nadu',
    occupation: 'Data Analyst',
    hardSkills: ['SQL', 'Python', 'Power BI', 'Excel'],
    softSkills: ['Analytical thinking', 'Presentation', 'Curiosity'],
    links: [
      ['LINKEDIN', 'https://linkedin.com/in/arjun-iyer'],
      ['GITHUB', 'https://github.com/arjuniyer'],
    ],
  },
  {
    email: 'sara.khan@example.com',
    firstName: 'Sara',
    lastName: 'Khan',
    phone: '+919810000105',
    gender: 'FEMALE',
    city: 'Delhi',
    state: 'Delhi',
    occupation: 'Customer Success Associate',
    hardSkills: ['CRM', 'Email support', 'Onboarding', 'Reporting'],
    softSkills: ['Empathy', 'Patience', 'Problem solving'],
    links: [['LINKEDIN', 'https://linkedin.com/in/sara-khan']],
  },
  {
    email: 'dev.patel@example.com',
    firstName: 'Dev',
    lastName: 'Patel',
    phone: '+919810000106',
    gender: 'MALE',
    city: 'Ahmedabad',
    state: 'Gujarat',
    occupation: 'UI Designer',
    hardSkills: ['Figma', 'Design systems', 'Prototyping', 'User research'],
    softSkills: ['Taste', 'Clarity', 'Iteration'],
    links: [
      ['LINKEDIN', 'https://linkedin.com/in/dev-patel'],
      ['PORTFOLIO', 'https://devpatel.design'],
    ],
  },
];

const jobCategories = [
  [
    'Software Development',
    'software-development',
    'Frontend, backend, and full-stack freelance roles',
  ],
  ['Design', 'design', 'UI, UX, brand, and product design assignments'],
  [
    'Content & Marketing',
    'content-marketing',
    'Writing, SEO, social, and growth work',
  ],
  [
    'Data & Operations',
    'data-operations',
    'Analytics, research, operations, and support roles',
  ],
];

const jobs = [
  {
    slug: 'nextjs-frontend-developer',
    categorySlug: 'software-development',
    title: 'Next.js Frontend Developer',
    summary:
      'Build polished dashboards and candidate-facing screens for a fast-moving product team.',
    description:
      'We need a dependable frontend developer who can turn product requirements into accessible, responsive Next.js interfaces.',
    skills: ['Next.js', 'TypeScript', 'Tailwind CSS', 'React Hook Form'],
    requirements: [
      '2+ years of frontend experience',
      'Strong component architecture',
      'Comfortable with API integration',
    ],
    location: 'Remote - India',
    workMode: 'REMOTE',
    duration: '8 weeks',
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    slug: 'nestjs-api-engineer',
    categorySlug: 'software-development',
    title: 'NestJS API Engineer',
    summary: 'Extend backend APIs, Prisma models, and operational workflows.',
    description:
      'The role involves shipping maintainable NestJS services, database-backed features, and integration-ready APIs.',
    skills: ['NestJS', 'Prisma', 'PostgreSQL', 'JWT'],
    requirements: [
      'Production Node.js experience',
      'Database schema design',
      'Testing discipline',
    ],
    location: 'Hybrid - Bengaluru',
    workMode: 'HYBRID',
    duration: '12 weeks',
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    slug: 'product-ui-designer',
    categorySlug: 'design',
    title: 'Product UI Designer',
    summary: 'Design clean operational screens for recruiters and candidates.',
    description:
      'Create flows, components, and prototypes that make complex job workflows feel simple.',
    skills: ['Figma', 'Design systems', 'Interaction design', 'User research'],
    requirements: [
      'Portfolio with SaaS or dashboard work',
      'Strong visual hierarchy',
      'Developer handoff experience',
    ],
    location: 'Remote - India',
    workMode: 'REMOTE',
    duration: '6 weeks',
    openings: 1,
    status: 'PUBLISHED',
  },
  {
    slug: 'seo-content-writer',
    categorySlug: 'content-marketing',
    title: 'SEO Content Writer',
    summary:
      'Write guides, landing copy, and help content for freelance talent.',
    description:
      'Research and publish useful content for candidates exploring freelance and contract opportunities.',
    skills: ['SEO', 'Content research', 'Editing', 'CMS'],
    requirements: [
      'Excellent written English',
      'Understanding of search intent',
      'Ability to meet weekly deadlines',
    ],
    location: 'Remote',
    workMode: 'REMOTE',
    duration: '4 weeks',
    openings: 4,
    status: 'PUBLISHED',
  },
  {
    slug: 'recruitment-operations-analyst',
    categorySlug: 'data-operations',
    title: 'Recruitment Operations Analyst',
    summary: 'Maintain hiring data, reports, and recruiter workflows.',
    description:
      'Support recruiters with structured data, candidate pipeline hygiene, and weekly reporting.',
    skills: ['Excel', 'SQL', 'Reporting', 'Process operations'],
    requirements: [
      'Detail-oriented work style',
      'Basic analytics experience',
      'Clear written updates',
    ],
    location: 'Onsite - Mumbai',
    workMode: 'ONSITE',
    duration: '10 weeks',
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    slug: 'customer-success-associate',
    categorySlug: 'data-operations',
    title: 'Customer Success Associate',
    summary: 'Help new freelancers complete onboarding and profile setup.',
    description:
      'Guide candidates through documentation, eligibility checks, and first project readiness.',
    skills: ['Customer support', 'CRM', 'Communication', 'Documentation'],
    requirements: [
      'Friendly support tone',
      'Comfortable with spreadsheets',
      'Can handle daily queues',
    ],
    location: 'Remote - India',
    workMode: 'REMOTE',
    duration: '6 weeks',
    openings: 5,
    status: 'DRAFT',
  },
];

const faqCategories = [
  ['Getting Started', 'Account setup, verification, and first steps'],
  ['Applications', 'How candidates apply for freelance opportunities'],
  ['Payments', 'Payment cycles, documents, and invoices'],
  ['Profile', 'Profile completion and visibility'],
];

const faqs = [
  [
    'How do I verify my account?',
    'Register with your email, request an OTP, and submit it from the verification screen.',
    'Getting Started',
  ],
  [
    'Can I apply to multiple jobs?',
    'Yes. You can apply to every job where you meet the eligibility criteria.',
    'Applications',
  ],
  [
    'Why is a job not visible to me?',
    'Some jobs may be drafts, closed, archived, or restricted by eligibility rules.',
    'Applications',
  ],
  [
    'When are payments processed?',
    'Payment timelines depend on the project agreement and approved deliverables.',
    'Payments',
  ],
  [
    'Can I update my skills later?',
    'Yes. Keep your profile skills, education, and social links updated from your profile page.',
    'Profile',
  ],
  [
    'What documents should I keep ready?',
    'Keep identity, tax, resume, portfolio, and relevant work samples ready where applicable.',
    'Getting Started',
  ],
];

const testimonials = [
  [
    'Priya Nair',
    'Frontend Freelancer',
    'Titan helped me find contract work that matched my stack and availability.',
    '2025-02-10',
  ],
  [
    'Kabir Das',
    'Recruiter',
    'The structured profiles and eligibility filters made shortlisting much faster.',
    '2025-03-18',
  ],
  [
    'Nisha Verma',
    'Content Consultant',
    'I could understand each opportunity clearly before applying, which saved a lot of time.',
    '2025-05-04',
  ],
  [
    'Rohan Singh',
    'Operations Analyst',
    'The onboarding flow was straightforward and the team communication was crisp.',
    '2025-06-21',
  ],
];

async function main() {
  console.log('Seeding roles and permissions...');
  const roleByName = {};
  for (const [name, description] of roles) {
    roleByName[name] = await prisma.role.upsert({
      where: { name },
      update: { description, isSystem: true },
      create: { name, description, isSystem: true },
    });
  }

  const permissionByKey = {};
  for (const [key, module, description] of permissions) {
    permissionByKey[key] = await prisma.permission.upsert({
      where: { key },
      update: { module, description },
      create: { key, module, description },
    });
  }

  await grant(roleByName.ADMIN, Object.values(permissionByKey));
  await grant(roleByName.RECRUITER, [
    permissionByKey['users.read'],
    permissionByKey['jobs.read'],
    permissionByKey['jobs.manage'],
    permissionByKey['faq.manage'],
  ]);
  await grant(roleByName.CANDIDATE, [permissionByKey['jobs.read']]);

  console.log('Ensuring admin and recruiter users...');
  const admin = await upsertUser({
    email: 'admin@titan.local',
    firstName: 'System',
    lastName: 'Admin',
    phone: '+10000000001',
    role: roleByName.ADMIN,
    preserveExisting: true,
  });
  await upsertUser({
    email: 'recruiter@titan.local',
    firstName: 'Recruitment',
    lastName: 'Team',
    phone: '+10000000002',
    role: roleByName.RECRUITER,
    preserveExisting: true,
  });

  console.log('Seeding candidate profiles...');
  for (const profile of candidateProfiles) {
    const user = await upsertUser({ ...profile, role: roleByName.CANDIDATE });
    await prisma.userAddress.deleteMany({ where: { userId: user.id } });
    await prisma.userEducation.deleteMany({ where: { userId: user.id } });
    await prisma.userSocialMediaLink.deleteMany({ where: { userId: user.id } });
    await prisma.consentRecord.deleteMany({ where: { userId: user.id } });

    await prisma.userAddress.create({
      data: {
        userId: user.id,
        addressType: 'CURRENT',
        addressLine: `${100 + candidateProfiles.indexOf(profile)}, Sample Residency`,
        city: profile.city,
        state: profile.state,
        country: 'India',
        postalCode: `5600${candidateProfiles.indexOf(profile) + 10}`,
        isPrimary: true,
      },
    });
    await prisma.userEducation.create({
      data: {
        userId: user.id,
        institution: 'Titan Skills University',
        degree: 'Bachelor of Technology',
        fieldOfStudy: profile.occupation.includes('Content')
          ? 'Mass Communication'
          : 'Computer Science',
        startDate: new Date('2018-07-01'),
        endDate: new Date('2022-05-31'),
        grade: 'First Class',
      },
    });
    await prisma.userProfessionalInfo.upsert({
      where: { userId: user.id },
      update: {
        languages: ['English', 'Hindi'],
        hardSkills: profile.hardSkills,
        softSkills: profile.softSkills,
        currentOccupation: profile.occupation,
      },
      create: {
        userId: user.id,
        languages: ['English', 'Hindi'],
        hardSkills: profile.hardSkills,
        softSkills: profile.softSkills,
        currentOccupation: profile.occupation,
      },
    });
    await prisma.userSocialMediaLink.createMany({
      data: profile.links.map(([socialMediaType, url]) => ({
        userId: user.id,
        socialMediaType,
        url,
      })),
    });
    await prisma.consentRecord.createMany({
      data: ['TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'MARKETING_EMAILS'].map(
        (type) => ({
          userId: user.id,
          type,
          version: '2026.09',
          ipAddress: '127.0.0.1',
          userAgent: 'Prisma seed',
        }),
      ),
    });
  }

  console.log(
    'Seeding categories, jobs, application fields, and eligibility rules...',
  );
  const categoryBySlug = {};
  for (const [name, slug, description] of jobCategories) {
    categoryBySlug[slug] = await prisma.jobCategory.upsert({
      where: { slug },
      update: {
        name,
        description,
        isActive: true,
        sortOrder: jobCategories.findIndex((item) => item[1] === slug) + 1,
      },
      create: {
        name,
        slug,
        description,
        isActive: true,
        sortOrder: jobCategories.findIndex((item) => item[1] === slug) + 1,
      },
    });
  }

  const resumeDocumentType = await prisma.documentType.upsert({
    where: { key: 'resume' },
    update: {
      name: 'Resume',
      description: 'Candidate resume or CV',
      allowedMimeTypes: ['application/pdf'],
      maxSizeBytes: 10 * 1024 * 1024,
      sensitive: false,
      allowCandidateReuse: true,
      isActive: true,
    },
    create: {
      key: 'resume',
      name: 'Resume',
      description: 'Candidate resume or CV',
      allowedMimeTypes: ['application/pdf'],
      maxSizeBytes: 10 * 1024 * 1024,
      sensitive: false,
      allowCandidateReuse: true,
    },
  });
  const portfolioProfileField = await prisma.candidateProfileField.upsert({
    where: { key: 'portfolio_url' },
    update: {
      label: 'Portfolio URL',
      description: 'A link to the candidate’s portfolio or work samples.',
      fieldType: 'URL',
      isSensitive: false,
      isActive: true,
    },
    create: {
      key: 'portfolio_url',
      label: 'Portfolio URL',
      description: 'A link to the candidate’s portfolio or work samples.',
      fieldType: 'URL',
    },
  });

  for (const job of jobs) {
    const savedJob = await prisma.job.upsert({
      where: { slug: job.slug },
      update: {
        title: job.title,
        categoryId: categoryBySlug[job.categorySlug].id,
        createdById: admin.id,
        summary: job.summary,
        description: job.description,
        skills: job.skills,
        requirements: job.requirements,
        location: job.location,
        workMode: job.workMode,
        duration: job.duration,
        openings: job.openings,
        status: job.status,
        publishedAt: job.status === 'PUBLISHED' ? now : null,
        applicationDeadline:
          job.status === 'PUBLISHED' ? nextSixWeeks : nextMonth,
        applicationInstructions: [
          'Complete your profile before applying',
          'Attach work samples where relevant',
          'Answer every required question',
        ],
        workInstructions: [
          'Weekly status update required',
          'Use agreed project tools',
          'Keep communication documented',
        ],
        additionalInfo: {
          seeded: true,
          priority: job.openings > 2 ? 'high' : 'standard',
        },
      },
      create: {
        slug: job.slug,
        title: job.title,
        categoryId: categoryBySlug[job.categorySlug].id,
        createdById: admin.id,
        summary: job.summary,
        description: job.description,
        skills: job.skills,
        requirements: job.requirements,
        location: job.location,
        workMode: job.workMode,
        duration: job.duration,
        openings: job.openings,
        status: job.status,
        publishedAt: job.status === 'PUBLISHED' ? now : null,
        applicationDeadline:
          job.status === 'PUBLISHED' ? nextSixWeeks : nextMonth,
        applicationInstructions: [
          'Complete your profile before applying',
          'Attach work samples where relevant',
          'Answer every required question',
        ],
        workInstructions: [
          'Weekly status update required',
          'Use agreed project tools',
          'Keep communication documented',
        ],
        additionalInfo: {
          seeded: true,
          priority: job.openings > 2 ? 'high' : 'standard',
        },
      },
    });

    await prisma.jobApplicationField.deleteMany({
      where: { jobId: savedJob.id },
    });
    await prisma.jobEligibilityRule.deleteMany({
      where: { jobId: savedJob.id },
    });
    await prisma.jobApplicationField.createMany({
      data: [
        ['coverLetter', 'TEXT', 'Cover letter', true, 1, null],
        ['portfolioUrl', 'URL', 'Portfolio or work sample URL', false, 2, null],
        ['expectedRate', 'NUMBER', 'Expected hourly rate', true, 3, null],
        [
          'availability',
          'SELECT',
          'Availability',
          true,
          4,
          ['Immediate', '1 week', '2 weeks', '1 month'],
        ],
        ['resume', 'FILE', 'Resume', true, 5, null],
      ].map(
        ([fieldKey, fieldType, label, required, displayOrder, options]) => ({
          jobId: savedJob.id,
          fieldKey,
          fieldType,
          label,
          required,
          displayOrder,
          profileFieldId:
            fieldKey === 'portfolioUrl' ? portfolioProfileField.id : undefined,
          documentTypeId:
            fieldType === 'FILE' ? resumeDocumentType.id : undefined,
          options: options ? { choices: options } : undefined,
        }),
      ),
    });
    await prisma.jobEligibilityRule.createMany({
      data: [
        ['experienceYears', 'NUMBER', 'GTE', 1, 1],
        ['profileCompleted', 'BOOLEAN', 'EQ', true, 2],
        ['country', 'SELECT', 'EQ', 'India', 3],
      ].map(([fieldKey, fieldType, operator, value, displayOrder]) => ({
        jobId: savedJob.id,
        fieldKey,
        fieldType,
        operator,
        value,
        displayOrder,
      })),
    });
  }

  console.log('Seeding FAQs and testimonials...');
  const faqCategoryByName = {};
  for (const [name, description] of faqCategories) {
    const sortOrder = faqCategories.findIndex((item) => item[0] === name) + 1;
    const existing = await prisma.faqCategory.findFirst({ where: { name } });
    faqCategoryByName[name] = existing
      ? await prisma.faqCategory.update({
          where: { id: existing.id },
          data: { name, description, status: 'PUBLISHED', sortOrder },
        })
      : await prisma.faqCategory.create({
          data: { name, description, status: 'PUBLISHED', sortOrder },
        });
  }

  await prisma.faq.deleteMany({
    where: { category: { in: faqCategories.map(([name]) => name) } },
  });
  await prisma.faq.createMany({
    data: faqs.map(([question, answer, category], index) => ({
      question,
      answer,
      category,
      faqCategoryId: faqCategoryByName[category].id,
      status: 'PUBLISHED',
      sortOrder: index + 1,
    })),
  });

  if (await tableExists('testimonials')) {
    await prisma.testimonial.deleteMany({
      where: { authorName: { in: testimonials.map(([name]) => name) } },
    });
    await prisma.testimonial.createMany({
      data: testimonials.map(
        ([authorName, authorRole, quote, joinedAt], index) => ({
          authorName,
          authorRole,
          quote,
          joinedAt: new Date(joinedAt),
          status: 'PUBLISHED',
          sortOrder: index + 1,
        }),
      ),
    });
  } else {
    console.warn(
      'Skipping testimonials: public.testimonials table is missing.',
    );
  }

  console.log(`Seed complete. Sample user password: ${seededPassword}`);
}

async function grant(role, grantedPermissions) {
  for (const permission of grantedPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }
}

async function upsertUser({
  email,
  firstName,
  lastName,
  phone,
  gender = 'NOT_DISCLOSED',
  role,
  preserveExisting = false,
}) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { personalEmail: email }, { phone }] },
  });
  const data = {
    email,
    personalEmail: email,
    phone,
    firstName,
    lastName,
    gender,
    whatsappNumber: phone,
    dateOfBirth: new Date('1998-01-15'),
    passwordHash,
    status: 'ACTIVE',
    emailVerifiedAt: now,
    announcementEmailOptOut: false,
    additionalDetails: { seeded: true, source: 'prisma/seed.js' },
  };

  const user =
    existing && preserveExisting
      ? existing
      : existing
        ? await prisma.user.update({ where: { id: existing.id }, data })
        : await prisma.user.create({ data });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
}

async function tableExists(tableName) {
  const result = await prisma.$queryRaw`
    SELECT to_regclass(${`public.${tableName}`})::text AS table_name
  `;

  return Boolean(result[0]?.table_name);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
