import mongoose from 'mongoose';
import { catchAsync, escapeRegex, serializeCsv } from '../../helpers/helpers.js';
import Role, { getNextRoleId } from '../../models/roles/roles.model.js';
import GetAllUsers from '../../models/users/users.model.js';
import {
  SYSTEM_PERMISSIONS_CATALOGUE,
  ROLES_CSV_EXPORT_HEADERS,
} from '../../constants/permissions/permissions.constants.js';

export const buildRoleFilter = ({ search, roleType, status }) => {
  const filter = { isDeleted: { $ne: true } };

  if (typeof search === 'string' && search.trim().length > 0) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, 'i');
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { roleId: searchRegex },
      { roleType: searchRegex },
    ];
  }

  if (
    typeof roleType === 'string' &&
    roleType.trim().length > 0 &&
    roleType.trim().toLowerCase() !== 'all'
  ) {
    filter.roleType = String(roleType).trim();
  }

  if (
    typeof status === 'string' &&
    status.trim().length > 0 &&
    status.trim().toLowerCase() !== 'all'
  ) {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'active' || normalized === 'true') {
      filter.isActive = { $ne: false };
    } else if (normalized === 'inactive' || normalized === 'false') {
      filter.isActive = false;
    }
  }

  return filter;
};

export const checkDuplicateRoleName = async (name, excludeId) => {
  const sanitizedName = typeof name === 'string' ? name.trim() : '';
  const nameRegex = new RegExp(`^${escapeRegex(sanitizedName)}$`, 'i');
  const query = { name: nameRegex, isDeleted: { $ne: true } };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  return Role.findOne(query).lean();
};

export const applyRoleProperties = (
  role,
  { name, description, roleType, permissions, isActive }
) => {
  if (typeof name === 'string') role.name = name.trim();
  if (typeof description === 'string') role.description = description.trim();
  if (typeof roleType === 'string' && !role.isSystem) role.roleType = roleType.trim();
  if (Array.isArray(permissions)) role.permissions = permissions;
  if (typeof isActive === 'boolean' && role.name !== 'Taskflow Admin') role.isActive = isActive;
};

export const findActiveRole = (idParam, { lean = false } = {}) => {
  const sanitizedId = String(idParam || '').trim();
  const query = mongoose.Types.ObjectId.isValid(sanitizedId)
    ? { _id: sanitizedId, isDeleted: { $ne: true } }
    : { roleId: sanitizedId, isDeleted: { $ne: true } };

  const queryChain = Role.findOne(query);
  return lean ? queryChain.lean() : queryChain;
};

/**
 * GET /api/v1/roles/permissions
 * Retrieve grouped system permissions catalogue for dynamic UI rendering
 */
export const getPermissionsCatalogue = catchAsync(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: SYSTEM_PERMISSIONS_CATALOGUE,
  });
});

/**
 * GET /api/v1/roles
 * Retrieve paginated list of non-deleted roles
 */
export const getAllRoles = catchAsync(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page), 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit), 10) || 10));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const roleType = typeof req.query.roleType === 'string' ? req.query.roleType.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const skip = (page - 1) * limit;

  const filter = buildRoleFilter({ search, roleType, status });

  const [roles, totalRoles] = await Promise.all([
    Role.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Role.countDocuments(filter),
  ]);

  const sanitizedRoles = roles.map((r, index) => ({
    ...r,
    roleId: r.roleId || `RL${String(skip + index + 1).padStart(4, '0')}`,
    isActive: r.isActive !== false,
  }));

  const totalPages = Math.ceil(totalRoles / limit) || 1;

  return res.status(200).json({
    success: true,
    pagination: {
      totalItems: totalRoles,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: sanitizedRoles,
  });
});

/**
 * GET /api/v1/roles/:id
 * Retrieve single role by ID or roleId
 */
export const getRoleById = catchAsync(async (req, res) => {
  const role = await findActiveRole(req.params.id, { lean: true });

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found or has been deleted.',
    });
  }

  return res.status(200).json({
    success: true,
    data: role,
  });
});

/**
 * POST /api/v1/roles
 * Create a new custom or predefined role
 */
export const createRole = catchAsync(async (req, res) => {
  const { name, description, roleType = 'Custom', permissions = [], isActive = true } = req.body;

  const duplicate = await checkDuplicateRoleName(name);
  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: 'A role with this name already exists. Please choose a different name.',
    });
  }

  const roleId = await getNextRoleId();

  const newRole = await Role.create({
    roleId,
    name: name.trim(),
    description: description ? description.trim() : '',
    roleType,
    permissions: Array.isArray(permissions) ? permissions : [],
    isActive,
    isSystem: false,
  });

  return res.status(201).json({
    success: true,
    message: 'Role created successfully.',
    data: newRole,
  });
});

/**
 * PUT /api/v1/roles/:id
 * Update an existing role
 */
export const updateRole = catchAsync(async (req, res) => {
  const { name, description, roleType, permissions, isActive } = req.body;
  const role = await findActiveRole(req.params.id);

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found or has been deleted.',
    });
  }

  if (name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
    const duplicate = await checkDuplicateRoleName(name, role._id);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'A role with this name already exists. Please choose a unique name.',
      });
    }
  }

  if (role.isSystem && role.name === 'Taskflow Admin' && isActive === false) {
    return res.status(400).json({
      success: false,
      message: 'Taskflow Admin role cannot be deactivated.',
    });
  }

  applyRoleProperties(role, { name, description, roleType, permissions, isActive });
  await role.save();

  return res.status(200).json({
    success: true,
    message: 'Role updated successfully.',
    data: role,
  });
});

/**
 * DELETE /api/v1/roles/:id
 * Soft-delete a role with protection for system roles and assigned users
 */
export const deleteRole = catchAsync(async (req, res) => {
  const role = await findActiveRole(req.params.id);

  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found or has been deleted.',
    });
  }

  if (role.isSystem || role.name === 'Taskflow Admin') {
    return res.status(400).json({
      success: false,
      message: 'Deletion prohibited: System protected roles cannot be deleted.',
    });
  }

  const usersWithRole = await GetAllUsers.countDocuments({
    role: role.name,
    isDeleted: { $ne: true },
  });

  if (usersWithRole > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role: ${usersWithRole} active user(s) are currently assigned to '${role.name}'. Please reassign them before deleting.`,
    });
  }

  role.isDeleted = true;
  role.deletedAt = new Date();
  await role.save();

  return res.status(200).json({
    success: true,
    message: 'Role deleted successfully.',
    data: { roleId: role.roleId, id: role._id },
  });
});

/**
 * GET /api/v1/roles/export
 * Export roles matching filters to CSV or JSON
 */
export const exportRoles = catchAsync(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const roleType = typeof req.query.roleType === 'string' ? req.query.roleType.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const format =
    typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : 'json';

  const filter = buildRoleFilter({ search, roleType, status });
  const roles = await Role.find(filter).sort({ createdAt: -1 }).lean();

  const formattedRoles = roles.map((r) => {
    const roleId = r.roleId || (r._id ? String(r._id) : 'N/A');
    const roleName = r.name || '';
    const description = r.description || '';
    const roleType = r.roleType || 'Custom';
    const permissions = r.permissions || [];
    const grantedPermissions = permissions.join('; ');
    const status = r.isActive !== false ? 'Active' : 'Inactive';
    const isSystem = Boolean(r.isSystem);
    const systemProtected = isSystem ? 'Yes' : 'No';
    const createdDate = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A';

    return {
      roleId,
      roleName,
      name: roleName,
      description,
      roleType,
      permissionsCount: permissions.length,
      permissions,
      grantedPermissions,
      status,
      isActive: r.isActive !== false,
      isSystem,
      systemProtected,
      createdDate,
      createdAt: r.createdAt,
    };
  });

  if (format === 'csv') {
    const headers = ROLES_CSV_EXPORT_HEADERS;

    const rows = formattedRoles.map((r) => [
      r.roleId,
      r.roleName,
      r.description,
      r.roleType,
      r.permissionsCount,
      r.grantedPermissions,
      r.status,
      r.systemProtected,
      r.createdDate,
    ]);

    const csvContent = '\uFEFF' + serializeCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=roles-export.csv');
    return res.status(200).send(csvContent);
  }

  return res.status(200).json({
    success: true,
    message: 'Roles exported successfully.',
    total: formattedRoles.length,
    data: formattedRoles,
  });
});

export const getRoles = getAllRoles;
