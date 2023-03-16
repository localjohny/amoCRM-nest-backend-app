import { Injectable } from '@nestjs/common';

import * as dotenv from 'dotenv';
dotenv.config();

import fetch from 'cross-fetch';
import * as moment from 'moment';
moment.locale('ru');

@Injectable()
export class AppService {
  private url = `https://${process.env.SUBDOMAIN}.amocrm.ru`;
  private headers = {
    Authorization: `Bearer ${process.env.BEARER_TOKEN}`,
    cookie: `session_id=${process.env.SESSION_ID}; user_lang=ru; `,
  };

  public contacts = {};
  public responsibles_users = {};

  async getContacts() {
    try {
      const url = `${this.url}/api/v4/contacts`;
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
      for (let contact of contacts) {
        if (this.contacts[contact.id]) continue;
        const data = {
          name: contact.name,
        };

        for (let field of contact.custom_fields_values) {
          if (!field.values[0]) continue;
          data[field.field_code] = field.values[0].value;
        }

        this.contacts[contact.id] = data;
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async getStatusIDs() {
    try {
      const url = `${this.url}/api/v4/leads/pipelines`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);
      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);
      const json = await request.json();

      const status_ids: any = {};

      const pipelines = json._embedded.pipelines;
      for (let pipeline of pipelines) {
        for (let status of pipeline._embedded.statuses) {
          status_ids[status.id] = {
            title: status.name,
            color: status.color,
          };
        }
      }

      return status_ids;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async getResponsibles() {
    try {
      const url = `${this.url}/api/v4/users`;
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
      for (let user of users) {
        if (this.responsibles_users[user.id]) continue;
        this.responsibles_users[user.id] = {
          name: user.name,
          email: user?.email,
        };
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async getLeads(query: string): Promise<[]> {
    try {
      const url = `${this.url}/api/v4/leads?order[id]=asc&with=contacts&query=${query}`;
      const options = {
        method: 'GET',
        headers: this.headers,
      };

      const request = await fetch(url, options);

      if (request.status !== 200)
        throw new Error(`${url} ${request.statusText}`);
      console.log(`${url} ${request.statusText}`);
      const json = await request.json();

      const status_ids = await this.getStatusIDs();
      const orders: any = [];

      const leads = json._embedded.leads;
      for (let lead of leads) {
        if (!this.responsibles_users[lead.responsible_user_id]) {
          const result = await this.getResponsibles();
          if (!result) throw new Error('Error in getResponsibles');
        }

        const data = {
          key: leads.indexOf(lead),
          name: lead.name,
          status_id: [status_ids[lead.status_id]],
          responsible_user_id:
            this.responsibles_users[lead.responsible_user_id].name,
          created_at: moment(lead.created_at * 1000).format(`D MMMM YYYY`),
          price: `${lead.price} ₽`,
          contacts: [],
        };

        const contacts = lead._embedded.contacts;
        for (let contact of contacts) {
          if (!this.contacts[contact.id]) {
            const result = await this.getContacts();
            if (!result) throw new Error('Error in getContacts');
          }

          data.contacts.push(this.contacts[contact.id]);
        }

        orders.push(data);
      }

      return orders;
    } catch (error) {
      console.log(error);
      return [];
    }
  }
}
