import { useLocation, useNavigate } from 'react-router-dom';

export const LocationListener = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (pathname === '/' || pathname === '/create') {
    navigate('/portal/catalog');
  } else if (pathname === '/create/tasks') {
    navigate('/portal/create/tasks');
  } else if (pathname === '/create/tasks/:taskId') {
    navigate('/portal/create/tasks/:taskId');
  } else if (pathname === '/catalog-import') {
    navigate('/portal/catalog-import');
  } else if (pathname === '/portal/catalog-import') {
    const linksInterval = setInterval(() => {
      let element = document.evaluate(
        '//*[@id="root"]/div/div/main/article/div/div[2]/div/div/div/div[7]/div/div/div/div/ul/div/div/div/div/a[1]',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue as HTMLElement;
      if (element) {
        element.style.display = 'none';
        element = document.evaluate(
          '//*[@id="root"]/div/div/main/article/div/div[2]/div/div/div/div[7]/div/div/div/div/ul/div/div/div/div/a[2]',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLElement;
        if (element) {
          element.style.display = 'none';
        }
        clearInterval(linksInterval);
      }
    }, 500);
  } else if (pathname.includes('/catalog/default/template/')) {
    navigate(`/portal/catalog/default/${pathname.split('/').pop()}`);
  }

  return null;
};
