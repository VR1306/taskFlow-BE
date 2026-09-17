import GetAllUsers from '../models/users/users.model.js';

export const SEED_USERS = [
  {
    userId: 'TF0001',
    firstName: 'Vijayaraghavan',
    lastName: 'K',
    email: 'vijayaraghavan130699@gmail.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
    role: 'SuperAdmin',
  },
  {
    userId: 'TF0002',
    firstName: 'Test',
    lastName: 'User',
    email: 'testuser@taskflow.com',
    password: process.env.TEST_USER_PASSWORD || 'TestUser@123',
    role: 'User',
  },
];

export const seedSuperAdmin = async () => {
  try {
    for (const user of SEED_USERS) {
      const existingUser = await GetAllUsers.findOne({ email: user.email });

      if (!existingUser) {
        await GetAllUsers.create({
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          password: user.password,
          role: user.role,
        });
        console.log(`⚡ Seed account '${user.email}' (${user.userId}) created successfully.`);
      } else if (!existingUser.userId) {
        await GetAllUsers.updateOne({ email: user.email }, { $set: { userId: user.userId } });
      }
    }
  } catch (error) {
    console.error('Error seeding SuperAdmin:', error.message);
  }
};
