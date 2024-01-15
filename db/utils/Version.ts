export default class Version {
  major: number;
  minor: number;
  patch: number;

  constructor(major: number, minor: number, patch: number) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  static isValid(text: string): boolean {
    return Version.parse(text) !== undefined;
  }

  static parse(text: string): Version | undefined {
    const parts = text.split(".");
    if (parts.length !== 3) return undefined;

    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]);
    if (isNaN(major) || isNaN(minor) || isNaN(patch)) return undefined;

    return new Version(major, minor, patch);
  }

  compare(other: Version): number {
    if (this.major != other.major) return other.major - this.major;
    if (this.minor != other.minor) return other.minor - this.minor;
    return other.patch - this.patch;
  }
}
