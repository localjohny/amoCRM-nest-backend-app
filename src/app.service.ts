import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as moment from 'moment';
import fetch from 'cross-fetch';

dotenv.config();
moment.locale('ru');

const API_URL: string = `https://${process.env.SUBDOMAIN}.amocrm.ru`;
const CREDENTIALS_FILEPATH: string = './.credentials.json';

import {
  ContactData,
  ResponsibleUserData,
  StatusData,
  LeadData,
} from './types';

@Injectable()
export class AppService {
  private contactsData: ContactData = {};
  private responsibleUsersData: ResponsibleUserData = {};
  private headers: { [key: string]: string } = {
    'Content-Type': 'application/json',
  };

  private async authorize(): Promise<boolean> {
    try {
      const data = {
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
        redirect_uri: process.env.REDIRECT_URI!,
      };

      const creds = fs.existsSync(CREDENTIALS_FILEPATH)
        ? JSON.parse(fs.readFileSync(CREDENTIALS_FILEPATH).toString('utf-8'))
        : null;

      if (
        creds?.expires_in! * 1000 >
        new Date().getTime() - creds?.created_at!
      ) {
        console.log(`Access_token not expired`);
        this.headers['Authorization'] = `Bearer ${creds.access_token}`;
        return true;
      }

      if (creds) {
        data['grant_type'] = 'refresh_token';
        data['refresh_token'] = creds.refresh_token;
      } else {
        data['grant_type'] = 'authorization_code';
        data['code'] = process.env.CODE!;
      }

      const url = `${API_URL}/oauth2/access_token`;
      const options = {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);

      const json = await request.json();
      if (!json.access_token) throw new Error('Error with get access_token');

      json.created_at = new Date().getTime();
      fs.writeFileSync(CREDENTIALS_FILEPATH, JSON.stringify(json));
      this.headers['Authorization'] = `Bearer ${json.access_token}`;

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  private async getContacts(): Promise<boolean> {
    try {
      const url = `${API_URL}/api/v4/contacts`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);

      const json = await request.json();
      const contacts = json._embedded.contacts;

      for (const contact of contacts) {
        if (this.contactsData[contact.id]) continue;
        const data = { name: contact.name };

        for (const field of contact.custom_fields_values) {
          if (!field.values[0]) continue;
          data[field.field_code] = field.values[0].value;
        }

        this.contactsData[contact.id] = data;
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  private async getStatuses(): Promise<StatusData> {
    try {
      const url = `${API_URL}/api/v4/leads/pipelines`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);

      const json = await request.json();
      const statusData: StatusData = {};

      const pipeslines = json._embedded.pipelines;
      for (const pipeline of pipeslines) {
        for (const status of pipeline._embedded.statuses) {
          statusData[status.id] = { title: status.name, color: status.color };
        }
      }

      return statusData;
    } catch (error) {
      console.log(error);
      return {};
    }
  }

  private async getResponsibleUsers(): Promise<boolean> {
    try {
      const url = `${API_URL}/api/v4/users`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);

      const json = await request.json();
      const users = json._embedded.users;
      for (const user of users) {
        if (this.responsibleUsersData[user.id]) continue;
        this.responsibleUsersData[user.id] = {
          name: user.name,
          email: user.email,
        };
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async getLeads(query: string): Promise<LeadData[]> {
    try {
      const url = `${API_URL}/api/v4/leads?order[id]=asc&with=contacts&query=${query}`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);

      const json = await request.json();
      const leads = json._embedded.leads;
      const statusData: StatusData = await this.getStatuses();

      const ordersData: LeadData[] = [];
      for (const lead of leads) {
        if (!this.responsibleUsersData[lead.responsible_user_id]) {
          const result = await this.getResponsibleUsers();
          if (!result) throw new Error('Error in getResponsibleUsers');
        }

        const data: LeadData = {
          key: leads.indexOf(lead),
          name: lead.name,
          status_id: [statusData[lead.status_id]],
          responsible_user_id:
            this.responsibleUsersData[lead.responsible_user_id].name,
          created_at: moment(lead.created_at * 1000).format(`D MMMM YYYY`),
          price: `${lead.price} ₽`,
          contacts: [],
        };

        const contacts = lead._embedded.contacts;
        for (const contact of contacts) {
          if (!this.contactsData[contact.id]) {
            const result = await this.getContacts();
            if (!result) throw new Error('Error in getContactsData');
          }

          data.contacts.push(this.contactsData[contact.id]);
        }

        ordersData.push(data);
      }

      return ordersData;
    } catch (error) {
      if (error.message.includes('Unauthorized')) {
        const result = await this.authorize();
        if (!result) throw new Error('Error in authorize');
        return this.getLeads(query);
      }

      if (!error.message.includes('No Content')) {
        console.log(error);
      }

      return [];
    }
  }
}
