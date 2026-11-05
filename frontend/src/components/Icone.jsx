// Jeu d'icônes du système, basé sur Font Awesome (solid).
// L'API reste la même (nom, size, className) : les pages n'ont pas à changer.
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen, faTrashCan, faDownload, faUpload, faShareNodes, faPlus, faXmark, faCheck,
  faChartColumn, faClipboardList, faFileLines, faClockRotateLeft, faComment, faImage,
  faBullseye, faPaperclip, faLock, faInbox, faSchool, faIdCard, faTriangleExclamation,
  faMobileScreen, faBuildingColumns, faRotate, faUsers, faEye, faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';

const ICONES = {
  edit: faPen,
  trash: faTrashCan,
  download: faDownload,
  upload: faUpload,
  share: faShareNodes,
  plus: faPlus,
  close: faXmark,
  check: faCheck,
  chart: faChartColumn,
  clipboard: faClipboardList,
  file: faFileLines,
  history: faClockRotateLeft,
  comment: faComment,
  image: faImage,
  target: faBullseye,
  attach: faPaperclip,
  lock: faLock,
  inbox: faInbox,
  school: faSchool,
  badge: faIdCard,
  warning: faTriangleExclamation,
  phone: faMobileScreen,
  bank: faBuildingColumns,
  refresh: faRotate,
  users: faUsers,
  eye: faEye,
  eyeSlash: faEyeSlash,
};

export default function Icone({ nom, size, className, ...rest }) {
  const icone = ICONES[nom];
  if (!icone) return null;
  // size (px) pour les grandes icônes (états vides) ; sinon aligné sur le texte.
  const style = { fontSize: size ? `${size}px` : '1.05em', verticalAlign: '-0.125em' };
  return <FontAwesomeIcon icon={icone} className={className} style={style} {...rest} />;
}
