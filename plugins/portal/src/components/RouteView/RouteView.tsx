import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { HomeComponent } from '../Home';
import { CatalogImport } from '../CatalogImport';
import { CreateTask } from '../CreateTask';
import { RunTask } from '../RunTask';
import { FeedbackFooter } from '../feedback/FeedbackFooter';
import { TaskList } from '../TaskList';
import { CatalogItemsDetails } from '../CatalogItemDetails';

export const RouteView = () => {
  return (
    <>
      <Routes>
        <Route path="catalog" element={<HomeComponent />} />
        <Route
          path="catalog/:namespace/:name"
          element={<CatalogItemsDetails />}
        />
        <Route path="catalog-import" element={<CatalogImport />} />
        <Route path="create">
          <Route path="templates/:namespace/:name" element={<CreateTask />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="tasks/:taskId" element={<RunTask />} />
        </Route>
        {/* Default redirects */}
        <Route path="/catalog/*" element={<Navigate to="/portal/catalog" />} />
        <Route path="*" element={<Navigate to="/portal/catalog" />} />
      </Routes>
      <FeedbackFooter />
    </>
  );
};
