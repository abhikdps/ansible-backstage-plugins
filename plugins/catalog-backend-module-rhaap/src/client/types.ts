export type PaginatedResponse = {
  count: number;
  next: string;
  previous: string;
  results: [];
};

export type User = {
  id: number;
  url: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
};

export type Users = User[];

export type Organization = {
  id: number;
  name: string;
  namespace: string;
};

export type Organizations = Record<number, Organization>;

export type Team = {
  id: number;
  name: string;
  organization: number;
  description: string;
  groupName: string;
};

export type Teams = Record<number, Team>;

export type RoleAssignment = Record<string, (string | number)[]>;
export type RoleAssignments = Record<number, RoleAssignment>;

export type SummaryField = {
  role_definition: {
    id: number;
    name: string;
  };
};

export type RoleAssignmentResponse = {
  user: number;
  object_id: string | number;
  summary_fields: SummaryField;
};
