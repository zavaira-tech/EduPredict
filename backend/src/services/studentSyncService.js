import Student from "../models/Student.js";
import User from "../models/User.js";

/**
 * Safely synchronizes all registered User accounts with role "student"
 * to ensure each has a corresponding Student academic profile.
 * - Existing profiles are linked and updated if name/email changed.
 * - Missing profiles are automatically created with default/unassigned values.
 * - No duplicate profiles are created.
 * - Existing accounts, passwords, and data are untouched.
 */
export async function syncStudentProfiles() {
  const studentUsers = await User.find({ role: "student" })
    .select("_id name email isActive")
    .lean();

  if (!studentUsers || !studentUsers.length) {
    return { synced: 0, created: 0 };
  }

  const userIds = studentUsers.map((u) => u._id);
  const emails = studentUsers.map((u) => u.email.toLowerCase());

  const existingStudents = await Student.find({
    $or: [
      { user: { $in: userIds } },
      { email: { $in: emails } },
    ],
  });

  const existingByUser = new Map();
  const existingByEmail = new Map();

  for (const s of existingStudents) {
    if (s.user) existingByUser.set(String(s.user), s);
    if (s.email) existingByEmail.set(s.email.toLowerCase(), s);
  }

  let created = 0;
  let synced = 0;

  for (const user of studentUsers) {
    const existing =
      existingByUser.get(String(user._id)) ||
      existingByEmail.get(user.email.toLowerCase());

    if (existing) {
      let modified = false;
      if (!existing.user || String(existing.user) !== String(user._id)) {
        existing.user = user._id;
        modified = true;
      }
      if (existing.name !== user.name) {
        existing.name = user.name;
        modified = true;
      }
      if (existing.email !== user.email.toLowerCase()) {
        existing.email = user.email.toLowerCase();
        modified = true;
      }
      if (user.isActive === false && existing.academicStatus === "Active") {
        existing.academicStatus = "Inactive";
        modified = true;
      } else if (user.isActive !== false && existing.academicStatus === "Inactive") {
        existing.academicStatus = "Active";
        modified = true;
      }
      if (modified) {
        await existing.save();
        synced++;
      }
      existingByUser.set(String(user._id), existing);
      existingByEmail.set(user.email.toLowerCase(), existing);
    } else {
      const studentId = await Student.generateNextStudentId();
      const newStudent = await Student.create({
        studentId,
        user: user._id,
        name: user.name,
        email: user.email.toLowerCase(),
        department: "Not assigned",
        program: "Not assigned",
        semester: 1,
        gpa: null,
        attendancePercentage: 0,
        academicStatus: user.isActive !== false ? "Active" : "Inactive",
      });
      existingByUser.set(String(user._id), newStudent);
      existingByEmail.set(user.email.toLowerCase(), newStudent);
      created++;
    }
  }

  return { total: studentUsers.length, synced, created };
}

/**
 * Ensures an individual registered student user has a Student profile.
 */
export async function ensureStudentProfile(user) {
  if (!user || user.role !== "student") return null;

  const existing = await Student.findOne({
    $or: [{ user: user._id }, { email: user.email.toLowerCase() }],
  });

  if (existing) {
    let modified = false;
    if (!existing.user || String(existing.user) !== String(user._id)) {
      existing.user = user._id;
      modified = true;
    }
    if (existing.name !== user.name) {
      existing.name = user.name;
      modified = true;
    }
    if (existing.email !== user.email.toLowerCase()) {
      existing.email = user.email.toLowerCase();
      modified = true;
    }
    if (modified) await existing.save();
    return existing;
  }

  const studentId = await Student.generateNextStudentId();
  return Student.create({
    studentId,
    user: user._id,
    name: user.name,
    email: user.email.toLowerCase(),
    department: "Not assigned",
    program: "Not assigned",
    semester: 1,
    gpa: null,
    attendancePercentage: 0,
    academicStatus: user.isActive !== false ? "Active" : "Inactive",
  });
}
