/*
 * Copyright 2024 The Ansible plugin Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode } from 'react';
import { GitHubIcon, InfoCard, Link } from '@backstage/core-components';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid,
  Typography,
  makeStyles,
  withStyles,
} from '@material-ui/core';
import ansibleWave from '../../../images/ansible-wave.png';
import { Tool } from '@backstage/plugin-home';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { WorkspaceIcon } from '../WorkspaceIcon';
import { useStarredEntities } from '@backstage/plugin-catalog-react';
import { DocumentIcon } from '../DocumentIcon';
import Star from '@material-ui/icons/Star';

const useStyles = makeStyles({
  container: {
    backgroundColor: 'default',
    padding: '20px',
  },
  flex: {
    display: 'flex',
  },
  fw_700: {
    fontWeight: 700,
  },
  img_wave: {
    width: '70px',
    height: '70px',
    margin: '5px',
  },
  outline: {
    strokeWidth: '2px',
    stroke: '#E4E4E4',
  },
  p16: {
    padding: 16,
  },
  ml25: {
    marginLeft: '25px',
  },
  fontSize14: {
    fontSize: '14px',
  },
  t_align_c: {
    textAlign: 'center',
  },
  link: {
    display: 'flex',
    gap: '24px',
    listStyle: 'none',
    paddingLeft: '16px',
  },
  a_link: {
    display: 'block',
    margin: '4px 8px',
    textDecoration: 'none'
  },
  icon_style: {
    display: 'inline-block',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#F8F8F8',
    textAlign: 'center',
    lineHeight: '32px',
    boxShadow:
      '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
  },
  icon_align: {
    color: '#06C',
    position: 'relative',
    top: '50%',
    transform: 'translateY(-40%)',
  },
  link_label: {
    color: '#181818',
    maxWidth: '96px',
    fontSize: '12px',
    wordBreak: 'break-word',
    marginTop: '8px',
  },
  description: {
    marginBottom: '30px',
  },
  star_icon: {
    float: 'left',
    marginRight: '10px',
  },
  kind: {
    color: '#757575',
  },
});

export interface IQuickAccessLinks {
  name?: string;
  description?: string;
  items?: Tool[];
}

export type QuickAccessProps = {
  data: IQuickAccessLinks;
  expanded?: boolean;
};

const links: IQuickAccessLinks = {
  name: 'Links',
  items: [
    {
      url: 'https://developers.redhat.com/products/ansible/overview?source=sso',
      label: 'Red Hat Developer',
      icon: <WorkspaceIcon />,
    },
    {
      url: 'https://red.ht/aap-creator-guide',
      label: 'Ansible Creator Guide',
      icon: <DocumentIcon />,
    },
    {
      url: 'https://access.redhat.com/documentation/en-us/red_hat_ansible_automation_platform',
      label: 'Ansible Automation Platform documentation',
      icon: <DocumentIcon />,
    },
  ],
};

const ansibleWorkspaces: IQuickAccessLinks = {
  name: 'Ansible development workspaces',
  description:
    'Create a workspace for multiple tools to easier develop ansible playbooks with roles.',
  items: [
    {
      url: 'https://developers.redhat.com',
      label: 'Red Hat Dev Spaces on OpenShift',
      icon: <WorkspaceIcon />,
    },
    {
      url: 'https://access.redhat.com/products/red-hat-openshift-dev-spaces',
      label: 'Documentation',
      icon: <DocumentIcon />,
    },
  ],
};

const discoverContent: IQuickAccessLinks = {
  name: 'Discover Content',
  description:
    'Private Automation Hub is a self-hosted Ansible content management system. Organizations can host private hubs on their own infrastructure and manage it themselves.',
  items: [
    {
      url: 'https://developers.redhat.com',
      label: 'Private Automation Hub',
      icon: <WorkspaceIcon />,
    },
    {
      url: 'https://red.ht/aap-pah-managing-content',
      label: 'Documentation',
      icon: <DocumentIcon />,
    },
  ],
};

const developerTools: IQuickAccessLinks = {
  name: 'Developer Tools',
  description:
    'Set of tools to help you build, test and deploy your automation content.',
  items: [
    {
      url: 'https://red.ht/aap-developer-tools',
      label: 'Ansible Developer Tools',
      icon: <WorkspaceIcon />,
    },
    {
      url: 'https://developers.redhat.com/products/ansible/lightspeed',
      label: 'Ansible Lightspeed',
      icon: <WorkspaceIcon />,
    },
    {
      url: 'https://red.ht/aap-code-bot-installation',
      label: 'Ansible code bot',
      icon: <GitHubIcon />,
    },
  ],
};

const EntityGettingStartedCard = ({ onTabChange }) => {
  const classes = useStyles();
  return (
    <InfoCard cardClassName={classes.outline} noPadding>
      <Typography variant="body1" className={classes.flex}>
        <img className={classes.img_wave} src={ansibleWave} alt="Hello!" />
        <div className={classes.p16}>
          <div className={`${classes.fw_700}`}>
            Welcome to Ansible Developer Hub!
          </div>
          Let’s help you get on your way and become an Ansible developer. Go to
          the&nbsp;
          <Link to="../learn" onClick={(e) => {
            e.stopPropagation();
            onTabChange(3);
          }}>
            Learn tab&nbsp;
          </Link>
          to get started.
        </div>
      </Typography>
    </InfoCard>
  );
};

const QuickAccessAccordion = ({ data, expanded }: QuickAccessProps) => {
  const classes = useStyles();

  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`panel${data.name}-content`}
        id={`panel${data.name}-header`}
        className={classes.ml25}
      >
        {data?.name?.toUpperCase()}
      </AccordionSummary>
      <AccordionDetails>
        <section>
          {data.description && (
            <Typography
              className={`${classes.fontSize14} ${classes.ml25} ${classes.description}`}
            >
              {data?.description}
            </Typography>
          )}
          <div>
            <ul className={classes.link}>
              {(data.items || []).map((item, index) => (
                <li key={index} className={classes.t_align_c}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={classes.a_link}
                  >
                    <div className={classes.icon_style}>
                      <div className={classes.icon_align}>{item.icon}</div>
                    </div>
                    <Typography className={classes.link_label}>
                      {item?.label}
                    </Typography>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </AccordionDetails>
    </Accordion>
  );
};

export const QuickAccessLinks = () => {
  return (
    <InfoCard title="Quick Access" noPadding>
      <Grid item>
        <QuickAccessAccordion data={links} expanded />
        <QuickAccessAccordion data={ansibleWorkspaces} />
        <QuickAccessAccordion data={discoverContent} />
        <QuickAccessAccordion data={developerTools} />
      </Grid>
    </InfoCard>
  );
};

const YellowStar = withStyles({
  root: {
    color: '#f3ba37',
  },
})(Star);

export const StarredItems = () => {
  const classes = useStyles();
  const { starredEntities } = useStarredEntities();

  const getStarredList = () => {
    const favList: ReactNode[] = [];

    starredEntities.forEach(item => {
      let kind = item.split(':')[0];
      kind = kind.charAt(0).toLocaleUpperCase() + kind.slice(1);
      const name = item.split('/')[1];
      favList.push(
        <li style={{ marginBottom: '22px' }}>
          <Typography variant="body1" className={classes.flex}>
            <Typography className={classes.star_icon}>
              <YellowStar />
            </Typography>
            <Typography>
              <Typography>
                <Link to="#">{name}</Link>
              </Typography>
              <Typography variant="subtitle1" className={classes.kind}>
                {kind}
              </Typography>
            </Typography>
          </Typography>
        </li>,
      );
    });
    return favList;
  };

  return (
    <InfoCard title="Starred Ansible Items">
      {starredEntities.size > 0 ? (
        <ul style={{ listStyle: 'none', paddingLeft: 10 }}>
          {getStarredList()}
        </ul>
      ) : (
        <Typography className={classes.kind}>
          Click the star beside an Ansible entity name to add it to this list!
        </Typography>
      )}
    </InfoCard>
  );
};

type IProps = {
  onTabChange: (index: number) => void
}

export const EntityOverviewContent = (props: IProps) => {
  return (
    <Grid container spacing={2} justifyContent="space-between">
      <Grid item xs={12}>
        <EntityGettingStartedCard {...props}/>
      </Grid>
      <Grid item xs={9}>
        <QuickAccessLinks />
      </Grid>
      <Grid item xs={3}>
        <StarredItems />
      </Grid>
    </Grid>
  );
};
