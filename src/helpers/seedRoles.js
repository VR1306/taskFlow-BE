import Role from '../models/roles/roles.model.js';
import { DEFAULT_SEED_ROLES } from '../constants/permissions/permissions.constants.js';

/**
 * Seed default roles and their permissions if they do not already exist
 */
export const seedDefaultRoles = async () => {
  try {
    for (const [index, roleData] of DEFAULT_SEED_ROLES.entries()) {
      const existing = await Role.findOne({
        name: roleData.name,
        isDeleted: { $ne: true },
      }).lean();

      if (!existing) {
        const paddedNum = String(index + 1).padStart(4, '0');
        await Role.create({
          roleId: `RL${paddedNum}`,
          name: roleData.name,
          description: roleData.description,
          roleType: roleData.roleType,
          permissions: roleData.permissions,
          isSystem: roleData.isSystem,
          isActive: roleData.isActive,
        });
        console.log(`Seeded default role: ${roleData.name}`);
      }
    }
  } catch (err) {
    console.error('Role seeding warning:', err.message);
  }
};

export default seedDefaultRoles;
