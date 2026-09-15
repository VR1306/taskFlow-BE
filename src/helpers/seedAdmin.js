import GetAllUsers from '../models/users/users.model.js';

export const seedSuperAdmin = async () => {
  try {
    const superAdminEmail = 'vijayaraghavan130699@gmail.com';
    const existingAdmin = await GetAllUsers.findOne({ email: superAdminEmail });

    if (!existingAdmin) {
      await GetAllUsers.create({
        firstName: 'Vijayaraghavan',
        lastName: 'K',
        email: superAdminEmail,
        password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
        role: 'SuperAdmin',
      });
      console.log('⚡ Initial SuperAdmin account seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding SuperAdmin:', error.message);
  }
};
