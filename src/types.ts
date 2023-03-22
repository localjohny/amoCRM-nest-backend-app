export interface ContactData {
  [id: string]: {
    name: string;
    [fieldCode: string]: any;
  };
}

export interface ResponsibleUserData {
  [id: string]: {
    name: string;
    email: string;
  };
}

export interface StatusData {
  [id: string]: {
    title: string;
    color: string;
  };
}

export interface LeadData {
  key: number;
  name: string;
  status_id: Object[];
  responsible_user_id: string;
  created_at: string;
  price: string;
  contacts: Object[];
}
